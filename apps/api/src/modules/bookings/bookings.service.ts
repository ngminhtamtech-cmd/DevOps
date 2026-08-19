import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Booking, BookingStatus } from '@t-hotel/shared-types';
import type { PoolClient } from 'pg';
import type { AuthenticatedUser } from '../../auth/auth.types';
import { assertValidStayRange } from '../../common/iso-date';
import { isPostgresError, PG_ERROR } from '../../common/postgres-errors';
import { DatabaseService } from '../../database/database.service';
import { CreateBookingDto } from './dto';

interface BookingRow {
  id: string;
  room_id: string;
  user_id: string;
  guest_name: string;
  guest_email: string;
  check_in: string;
  check_out: string;
  nights: number;
  status: BookingStatus;
  total_price_cents: string;
  created_at: Date;
  cancelled_at: Date | null;
}

const BOOKING_COLUMNS = `
  id, room_id, user_id, guest_name, guest_email,
  check_in::text as check_in, check_out::text as check_out,
  nights, status, total_price_cents, created_at, cancelled_at
`;

function toBooking(row: BookingRow): Booking {
  return {
    id: row.id,
    roomId: row.room_id,
    userId: row.user_id,
    guestName: row.guest_name,
    guestEmail: row.guest_email,
    checkIn: row.check_in,
    checkOut: row.check_out,
    nights: row.nights,
    status: row.status,
    totalPriceCents: Number(row.total_price_cents),
    createdAt: row.created_at.toISOString(),
    cancelledAt: row.cancelled_at ? row.cancelled_at.toISOString() : null,
  };
}

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(private readonly database: DatabaseService) {}

  /**
   * Tao booking. Day la cho R12 duoc thuc thi.
   *
   * Chien luoc: KHONG kiem tra truoc roi moi chen ("check-then-act"), vi giua hai
   * buoc do van con khe ho cho request khac chen vao. Thay vao do de INSERT chay
   * thang, va giao viec bao ve cho exclusion constraint trong database. Postgres
   * khoa o muc index nen hai transaction dong thoi cho cung phong, cung khoang
   * ngay se co dung mot cai thanh cong; cai con lai ném SQLSTATE 23P01 va duoc
   * doi thanh HTTP 409 tai day.
   *
   * Toan bo nam trong mot transaction de gia tien (doc tu rate_plans) va ban ghi
   * booking luon nhat quan voi nhau.
   */
  async create(dto: CreateBookingDto, user: AuthenticatedUser): Promise<Booking> {
    assertValidStayRange(dto.checkIn, dto.checkOut);

    try {
      return await this.database.transaction(async (client) => {
        const roomTypeId = await this.findRoomTypeIdOrThrow(client, dto.roomId);

        const priceResult = await client.query<{ total: string }>(
          'select public.calculate_stay_price($1, $2::date, $3::date) as total',
          [roomTypeId, dto.checkIn, dto.checkOut],
        );
        const totalPriceCents = Number(priceResult.rows[0].total);

        const inserted = await client.query<BookingRow>(
          `insert into public.bookings
             (room_id, user_id, guest_name, guest_email, check_in, check_out, total_price_cents, status)
           values ($1, $2, $3, $4, $5::date, $6::date, $7, 'confirmed')
           returning ${BOOKING_COLUMNS}`,
          [
            dto.roomId,
            user.id,
            dto.guestName,
            dto.guestEmail,
            dto.checkIn,
            dto.checkOut,
            totalPriceCents,
          ],
        );

        return toBooking(inserted.rows[0]);
      });
    } catch (error) {
      if (isPostgresError(error, PG_ERROR.EXCLUSION_VIOLATION)) {
        this.logger.warn(
          `Chan double-booking: phong ${dto.roomId} khoang ${dto.checkIn}..${dto.checkOut}`,
        );
        throw new ConflictException(
          'Phong da co nguoi dat trong khoang ngay nay. Vui long chon phong hoac ngay khac.',
        );
      }
      throw error;
    }
  }

  async findMine(userId: string): Promise<Booking[]> {
    const rows = await this.database.query<BookingRow>(
      `select ${BOOKING_COLUMNS} from public.bookings
       where user_id = $1
       order by check_in desc`,
      [userId],
    );
    return rows.map(toBooking);
  }

  async findByIdForUser(id: string, user: AuthenticatedUser): Promise<Booking> {
    const row = await this.database.queryOne<BookingRow>(
      `select ${BOOKING_COLUMNS} from public.bookings where id = $1`,
      [id],
    );
    if (!row) {
      throw new NotFoundException(`Khong tim thay booking ${id}`);
    }
    // Khach chi xem duoc booking cua chinh minh; admin xem duoc tat ca.
    if (user.role !== 'admin' && row.user_id !== user.id) {
      throw new ForbiddenException('Khong the xem booking cua nguoi khac');
    }
    return toBooking(row);
  }

  /**
   * Huy booking. Sau khi status = 'cancelled', menh de WHERE cua exclusion
   * constraint khong con ap dung nen khoang ngay do lap tuc mo lai cho khach khac.
   *
   * Dieu kien `status <> 'cancelled'` nam ngay trong cau UPDATE chu khong phai o
   * mot buoc kiem tra rieng truoc do: hai request huy song song se cung doc thay
   * 'confirmed' roi cung chay nhanh ghi. Hien tai ghi hai lan chi la thua, nhung
   * khi giai doan sau gan hoan tien vao day thi do la hoan tien hai lan.
   * Postgres khoa hang trong UPDATE, nen dung mot request nhan duoc hang tra ve.
   */
  async cancel(id: string, user: AuthenticatedUser): Promise<Booking> {
    // Kiem tra ton tai va quyen truoc, de tra ve 404/403 dung nghia.
    await this.findByIdForUser(id, user);

    const row = await this.database.queryOne<BookingRow>(
      `update public.bookings
       set status = 'cancelled', cancelled_at = now()
       where id = $1 and status <> 'cancelled'
       returning ${BOOKING_COLUMNS}`,
      [id],
    );
    if (row) {
      return toBooking(row);
    }

    // Khong co hang tra ve = booking da bi huy tu truoc, hoac vua bi mot request
    // song song huy xong. Huy lan hai khong phai loi. Doc lai de tra ve trang
    // thai MOI NHAT, khong dung ban chup doc o dau ham (no van con 'confirmed').
    return this.findByIdForUser(id, user);
  }

  private async findRoomTypeIdOrThrow(client: PoolClient, roomId: string): Promise<string> {
    const result = await client.query<{ room_type_id: string; status: string }>(
      'select room_type_id, status from public.rooms where id = $1',
      [roomId],
    );
    const room = result.rows[0];
    if (!room) {
      throw new NotFoundException(`Khong tim thay phong ${roomId}`);
    }
    if (room.status !== 'available') {
      throw new ConflictException('Phong dang bao tri, khong nhan dat');
    }
    return room.room_type_id;
  }
}

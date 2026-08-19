import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Room, RoomStatus } from '@t-hotel/shared-types';
import { isPostgresError, PG_ERROR } from '../../common/postgres-errors';
import { DatabaseService } from '../../database/database.service';
import { CreateRoomDto, ListRoomsQueryDto, UpdateRoomDto } from './dto';

interface RoomRow {
  id: string;
  hotel_id: string;
  room_type_id: string;
  room_number: string;
  floor: number | null;
  status: RoomStatus;
}

const ROOM_COLUMNS = 'id, hotel_id, room_type_id, room_number, floor, status';

function toRoom(row: RoomRow): Room {
  return {
    id: row.id,
    hotelId: row.hotel_id,
    roomTypeId: row.room_type_id,
    roomNumber: row.room_number,
    floor: row.floor,
    status: row.status,
  };
}

@Injectable()
export class RoomsService {
  constructor(private readonly database: DatabaseService) {}

  async findAll(query: ListRoomsQueryDto): Promise<Room[]> {
    // Loc dong: chi them dieu kien khi tham so co mat, van dung tham so hoa
    // ($1, $2, ...) nen khong co duong noi chuoi SQL nao tu input nguoi dung.
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (query.hotelId) {
      params.push(query.hotelId);
      conditions.push(`hotel_id = $${params.length}`);
    }
    if (query.roomTypeId) {
      params.push(query.roomTypeId);
      conditions.push(`room_type_id = $${params.length}`);
    }
    if (query.status) {
      params.push(query.status);
      conditions.push(`status = $${params.length}`);
    }

    const where = conditions.length ? `where ${conditions.join(' and ')}` : '';
    const rows = await this.database.query<RoomRow>(
      `select ${ROOM_COLUMNS} from public.rooms ${where} order by room_number`,
      params,
    );
    return rows.map(toRoom);
  }

  async findById(id: string): Promise<Room> {
    const row = await this.database.queryOne<RoomRow>(
      `select ${ROOM_COLUMNS} from public.rooms where id = $1`,
      [id],
    );
    if (!row) {
      throw new NotFoundException(`Khong tim thay phong ${id}`);
    }
    return toRoom(row);
  }

  async create(dto: CreateRoomDto): Promise<Room> {
    try {
      const row = await this.database.queryOne<RoomRow>(
        `insert into public.rooms (hotel_id, room_type_id, room_number, floor, status)
         values ($1, $2, $3, $4, coalesce($5, 'available'))
         returning ${ROOM_COLUMNS}`,
        [dto.hotelId, dto.roomTypeId, dto.roomNumber, dto.floor ?? null, dto.status ?? null],
      );
      return toRoom(row as RoomRow);
    } catch (error) {
      throw this.translateWriteError(error, dto.roomNumber);
    }
  }

  async update(id: string, dto: UpdateRoomDto): Promise<Room> {
    const assignments: string[] = [];
    const params: unknown[] = [id];

    const columnByField: Record<keyof UpdateRoomDto, string> = {
      roomTypeId: 'room_type_id',
      roomNumber: 'room_number',
      floor: 'floor',
      status: 'status',
    };

    for (const [field, column] of Object.entries(columnByField) as [
      keyof UpdateRoomDto,
      string,
    ][]) {
      const value = dto[field];
      if (value !== undefined) {
        params.push(value);
        assignments.push(`${column} = $${params.length}`);
      }
    }

    if (!assignments.length) {
      throw new BadRequestException('Khong co truong nao de cap nhat');
    }

    try {
      const row = await this.database.queryOne<RoomRow>(
        `update public.rooms set ${assignments.join(', ')} where id = $1 returning ${ROOM_COLUMNS}`,
        params,
      );
      if (!row) {
        throw new NotFoundException(`Khong tim thay phong ${id}`);
      }
      return toRoom(row);
    } catch (error) {
      throw this.translateWriteError(error, dto.roomNumber);
    }
  }

  async remove(id: string): Promise<void> {
    try {
      const row = await this.database.queryOne<{ id: string }>(
        'delete from public.rooms where id = $1 returning id',
        [id],
      );
      if (!row) {
        throw new NotFoundException(`Khong tim thay phong ${id}`);
      }
    } catch (error) {
      // rooms bi bookings tham chieu voi on delete restrict: khong cho xoa phong
      // da tung co booking, tranh mat lich su dat phong.
      if (isPostgresError(error, PG_ERROR.FOREIGN_KEY_VIOLATION)) {
        throw new ConflictException(
          'Phong da co booking nen khong the xoa. Hay doi status sang "maintenance".',
        );
      }
      throw error;
    }
  }

  private translateWriteError(error: unknown, roomNumber?: string): unknown {
    if (isPostgresError(error, PG_ERROR.UNIQUE_VIOLATION)) {
      return new ConflictException(`Khach san nay da co phong so ${roomNumber}`);
    }
    // Khoa ngoai ghep (migration 0003) khien ca hai tinh huong duoi day cung ném
    // 23503: id khong ton tai, va loai phong ton tai nhung thuoc khach san khac.
    if (isPostgresError(error, PG_ERROR.FOREIGN_KEY_VIOLATION)) {
      return new BadRequestException(
        'hotelId hoac roomTypeId khong ton tai, hoac loai phong khong thuoc khach san nay',
      );
    }
    return error;
  }
}

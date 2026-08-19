import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { RoomType } from '@t-hotel/shared-types';
import { countNights } from '../../common/iso-date';
import { isPostgresError, PG_ERROR } from '../../common/postgres-errors';
import { DatabaseService } from '../../database/database.service';
import { CreateRatePlanDto, CreateRoomTypeDto } from './dto';

interface RoomTypeRow {
  id: string;
  hotel_id: string;
  code: string;
  name: string;
  capacity: number;
  base_price_cents: string;
}

export interface RatePlan {
  id: string;
  roomTypeId: string;
  name: string;
  startDate: string;
  endDate: string;
  priceCents: number;
  priority: number;
}

interface RatePlanRow {
  id: string;
  room_type_id: string;
  name: string;
  start_date: string;
  end_date: string;
  price_cents: string;
  priority: number;
}

/**
 * pg tra bigint ve dang chuoi de khong mat do chinh xac voi so > 2^53.
 * Gia tien theo don vi cents cua T_Hotel luon nam trong tam an toan cua Number,
 * nen chuyen ve number ngay tai bien de tang tren khong phai lo kieu du lieu.
 */
function centsToNumber(value: string | number): number {
  return typeof value === 'number' ? value : Number(value);
}

function toRoomType(row: RoomTypeRow): RoomType {
  return {
    id: row.id,
    hotelId: row.hotel_id,
    code: row.code,
    name: row.name,
    capacity: row.capacity,
    basePriceCents: centsToNumber(row.base_price_cents),
  };
}

@Injectable()
export class RoomTypesService {
  constructor(private readonly database: DatabaseService) {}

  async findByHotel(hotelId: string): Promise<RoomType[]> {
    const rows = await this.database.query<RoomTypeRow>(
      `select id, hotel_id, code, name, capacity, base_price_cents
       from public.room_types
       where hotel_id = $1
       order by base_price_cents`,
      [hotelId],
    );
    return rows.map(toRoomType);
  }

  async findById(id: string): Promise<RoomType> {
    const row = await this.database.queryOne<RoomTypeRow>(
      `select id, hotel_id, code, name, capacity, base_price_cents
       from public.room_types where id = $1`,
      [id],
    );
    if (!row) {
      throw new NotFoundException(`Khong tim thay loai phong ${id}`);
    }
    return toRoomType(row);
  }

  async create(dto: CreateRoomTypeDto): Promise<RoomType> {
    try {
      const row = await this.database.queryOne<RoomTypeRow>(
        `insert into public.room_types (hotel_id, code, name, capacity, base_price_cents)
         values ($1, $2, $3, $4, $5)
         returning id, hotel_id, code, name, capacity, base_price_cents`,
        [dto.hotelId, dto.code, dto.name, dto.capacity, dto.basePriceCents],
      );
      return toRoomType(row as RoomTypeRow);
    } catch (error) {
      if (isPostgresError(error, PG_ERROR.UNIQUE_VIOLATION)) {
        throw new ConflictException(`Khach san nay da co loai phong "${dto.code}"`);
      }
      if (isPostgresError(error, PG_ERROR.FOREIGN_KEY_VIOLATION)) {
        throw new NotFoundException(`Khong tim thay khach san ${dto.hotelId}`);
      }
      throw error;
    }
  }

  async listRatePlans(roomTypeId: string): Promise<RatePlan[]> {
    await this.findById(roomTypeId);
    const rows = await this.database.query<RatePlanRow>(
      `select id, room_type_id, name,
              lower(valid_range)::text as start_date,
              upper(valid_range)::text as end_date,
              price_cents, priority
       from public.rate_plans
       where room_type_id = $1
       order by priority desc, lower(valid_range)`,
      [roomTypeId],
    );
    return rows.map((row) => ({
      id: row.id,
      roomTypeId: row.room_type_id,
      name: row.name,
      startDate: row.start_date,
      endDate: row.end_date,
      priceCents: centsToNumber(row.price_cents),
      priority: row.priority,
    }));
  }

  async createRatePlan(roomTypeId: string, dto: CreateRatePlanDto): Promise<RatePlan> {
    await this.findById(roomTypeId);

    if (countNights(dto.startDate, dto.endDate) <= 0) {
      throw new BadRequestException('endDate phai sau startDate');
    }

    const row = await this.database.queryOne<RatePlanRow>(
      `insert into public.rate_plans (room_type_id, name, valid_range, price_cents, priority)
       values ($1, $2, daterange($3::date, $4::date, '[)'), $5, $6)
       returning id, room_type_id, name,
                 lower(valid_range)::text as start_date,
                 upper(valid_range)::text as end_date,
                 price_cents, priority`,
      [roomTypeId, dto.name, dto.startDate, dto.endDate, dto.priceCents, dto.priority ?? 0],
    );
    const created = row as RatePlanRow;
    return {
      id: created.id,
      roomTypeId: created.room_type_id,
      name: created.name,
      startDate: created.start_date,
      endDate: created.end_date,
      priceCents: centsToNumber(created.price_cents),
      priority: created.priority,
    };
  }
}

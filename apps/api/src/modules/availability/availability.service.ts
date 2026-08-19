import { Injectable } from '@nestjs/common';
import type { AvailableRoom } from '@t-hotel/shared-types';
import { assertValidStayRange } from '../../common/iso-date';
import { DatabaseService } from '../../database/database.service';
import { SearchAvailabilityQueryDto } from './dto';

interface AvailableRoomRow {
  id: string;
  hotel_id: string;
  room_type_id: string;
  room_number: string;
  floor: number | null;
  status: 'available' | 'maintenance';
  room_type_code: string;
  room_type_name: string;
  capacity: number;
  total_price_cents: string;
}

/**
 * Truy van tim phong trong.
 *
 * Diem mau chot: `not exists` dua tren phep giao daterange `&&` voi cung cach
 * dong/mo `[)` nhu exclusion constraint tren bang bookings. Neu hai noi dinh
 * nghia khac nhau, man hinh tim kiem se bao con phong nhung khi dat lai bi tu
 * choi — dung mot cong thuc de hai tang luon dong y voi nhau.
 *
 * Truy van nay chi la goi y (advisory). Nguon su that cuoi cung van la
 * exclusion constraint luc INSERT, vi giua luc tim va luc dat, nguoi khac co
 * the da dat mat phong.
 */
const SEARCH_SQL = `
  select r.id,
         r.hotel_id,
         r.room_type_id,
         r.room_number,
         r.floor,
         r.status,
         rt.code as room_type_code,
         rt.name as room_type_name,
         rt.capacity,
         public.calculate_stay_price(rt.id, $1::date, $2::date) as total_price_cents
  from public.rooms r
  join public.room_types rt on rt.id = r.room_type_id
  where r.status = 'available'
    and ($3::uuid is null or r.hotel_id = $3::uuid)
    and ($4::uuid is null or r.room_type_id = $4::uuid)
    and ($5::int is null or rt.capacity >= $5::int)
    and not exists (
      select 1
      from public.bookings b
      where b.room_id = r.id
        and b.status <> 'cancelled'
        and daterange(b.check_in, b.check_out, '[)')
            && daterange($1::date, $2::date, '[)')
    )
  order by total_price_cents, r.room_number
`;

@Injectable()
export class AvailabilityService {
  constructor(private readonly database: DatabaseService) {}

  async search(query: SearchAvailabilityQueryDto): Promise<AvailableRoom[]> {
    const nights = assertValidStayRange(query.checkIn, query.checkOut);

    const rows = await this.database.query<AvailableRoomRow>(SEARCH_SQL, [
      query.checkIn,
      query.checkOut,
      query.hotelId ?? null,
      query.roomTypeId ?? null,
      query.guests ?? null,
    ]);

    return rows.map((row) => ({
      id: row.id,
      hotelId: row.hotel_id,
      roomTypeId: row.room_type_id,
      roomNumber: row.room_number,
      floor: row.floor,
      status: row.status,
      roomTypeCode: row.room_type_code,
      roomTypeName: row.room_type_name,
      capacity: row.capacity,
      nights,
      totalPriceCents: Number(row.total_price_cents),
    }));
  }
}

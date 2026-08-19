import { Injectable, NotFoundException } from '@nestjs/common';
import type { Hotel } from '@t-hotel/shared-types';
import { DatabaseService } from '../../database/database.service';
import { CreateHotelDto } from './dto';

interface HotelRow {
  id: string;
  name: string;
  address: string;
  city: string;
  created_at: Date;
}

function toHotel(row: HotelRow): Hotel {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    city: row.city,
    createdAt: row.created_at.toISOString(),
  };
}

@Injectable()
export class HotelsService {
  constructor(private readonly database: DatabaseService) {}

  async findAll(): Promise<Hotel[]> {
    const rows = await this.database.query<HotelRow>(
      'select id, name, address, city, created_at from public.hotels order by name',
    );
    return rows.map(toHotel);
  }

  async findById(id: string): Promise<Hotel> {
    const row = await this.database.queryOne<HotelRow>(
      'select id, name, address, city, created_at from public.hotels where id = $1',
      [id],
    );
    if (!row) {
      throw new NotFoundException(`Khong tim thay khach san ${id}`);
    }
    return toHotel(row);
  }

  async create(dto: CreateHotelDto): Promise<Hotel> {
    const row = await this.database.queryOne<HotelRow>(
      `insert into public.hotels (name, address, city)
       values ($1, $2, $3)
       returning id, name, address, city, created_at`,
      [dto.name, dto.address, dto.city],
    );
    return toHotel(row as HotelRow);
  }
}

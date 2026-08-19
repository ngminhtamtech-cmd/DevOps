import { Client } from 'pg';

export interface SeedOptions {
  connectionString: string;
  ssl?: boolean;
  /** id cua user Supabase Auth se duoc gan quyen admin. Bo trong thi bo qua buoc nay. */
  adminUserId?: string;
  adminEmail?: string;
  log?: (message: string) => void;
}

export interface SeedResult {
  hotelId: string;
  roomTypeIds: Record<string, string>;
  roomIds: string[];
}

const HOTEL = { name: 'T_Hotel Da Nang', address: '12 Vo Nguyen Giap', city: 'Da Nang' };

/**
 * Du lieu mau cho moi truong dev. Idempotent: chay lai nhieu lan khong sinh ban trung.
 *
 * Moi bang co mot cach nhan dien "da co roi" khac nhau: room_types va rooms dua
 * vao unique constraint san co nen dung `on conflict`, con hotels khong co unique
 * nao ngoai khoa chinh sinh tu dong — `on conflict do nothing` o do khong bao gio
 * kich hoat, nen phai hoi truoc bang `where not exists`.
 */
export async function seedDevData(options: SeedOptions): Promise<SeedResult> {
  const log = options.log ?? (() => undefined);
  const client = new Client({
    connectionString: options.connectionString,
    ssl: options.ssl ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();

  try {
    await client.query(
      `insert into public.hotels (name, address, city)
       select $1, $2, $3
       where not exists (
         select 1 from public.hotels where name = $1 and city = $3
       )`,
      [HOTEL.name, HOTEL.address, HOTEL.city],
    );

    const hotel = await client.query<{ id: string }>(
      'select id from public.hotels where name = $1 and city = $2 limit 1',
      [HOTEL.name, HOTEL.city],
    );
    const hotelId = hotel.rows[0].id;

    const roomTypeSpecs = [
      { code: 'single', name: 'Phong don', capacity: 1, basePriceCents: 60_000_00 },
      { code: 'double', name: 'Phong doi', capacity: 2, basePriceCents: 95_000_00 },
      { code: 'suite', name: 'Suite huong bien', capacity: 4, basePriceCents: 210_000_00 },
    ];

    const roomTypeIds: Record<string, string> = {};
    for (const spec of roomTypeSpecs) {
      const inserted = await client.query<{ id: string }>(
        `insert into public.room_types (hotel_id, code, name, capacity, base_price_cents)
         values ($1, $2, $3, $4, $5)
         on conflict (hotel_id, code) do update set name = excluded.name
         returning id`,
        [hotelId, spec.code, spec.name, spec.capacity, spec.basePriceCents],
      );
      roomTypeIds[spec.code] = inserted.rows[0].id;
    }

    // Cao diem he: gia suite tang, uu tien cao hon gia goc.
    await client.query(
      `insert into public.rate_plans (room_type_id, name, valid_range, price_cents, priority)
       select $1, 'Cao diem he 2026', daterange('2026-06-01', '2026-09-01', '[)'), $2, 10
       where not exists (
         select 1 from public.rate_plans where room_type_id = $1 and name = 'Cao diem he 2026'
       )`,
      [roomTypeIds.suite, 320_000_00],
    );

    const roomSpecs = [
      { number: '101', type: 'single', floor: 1 },
      { number: '102', type: 'single', floor: 1 },
      { number: '201', type: 'double', floor: 2 },
      { number: '202', type: 'double', floor: 2 },
      { number: '301', type: 'suite', floor: 3 },
    ];

    const roomIds: string[] = [];
    for (const spec of roomSpecs) {
      const inserted = await client.query<{ id: string }>(
        `insert into public.rooms (hotel_id, room_type_id, room_number, floor)
         values ($1, $2, $3, $4)
         on conflict (hotel_id, room_number) do update set floor = excluded.floor
         returning id`,
        [hotelId, roomTypeIds[spec.type], spec.number, spec.floor],
      );
      roomIds.push(inserted.rows[0].id);
    }

    if (options.adminUserId) {
      await client.query(
        `insert into public.profiles (id, email, full_name, role)
         values ($1, $2, 'Quan tri vien', 'admin')
         on conflict (id) do update set role = 'admin'`,
        [options.adminUserId, options.adminEmail ?? null],
      );
      log(`Da gan quyen admin cho user ${options.adminUserId}`);
    }

    log(`Seed xong: 1 khach san, ${roomTypeSpecs.length} loai phong, ${roomIds.length} phong.`);
    return { hotelId, roomTypeIds, roomIds };
  } finally {
    await client.end();
  }
}

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
  /** Khoang ngay va gia cua rate plan cao diem, doc lai tu database sau khi seed. */
  muaCaoDiem: { startDate: string; endDate: string; priceCents: number };
}

const HOTEL = { name: 'T_Hotel Da Nang', address: '12 Vo Nguyen Giap', city: 'Da Nang' };

/**
 * Rate plan cao diem dat theo ngay TUONG DOI so voi hom nay, khong phai ngay co
 * dinh. Mot khoang co dinh se troi vao qua khu sau vai thang, khien ban demo
 * khong con thay gia theo mua va khien test phu thuoc vao thoi diem chay.
 */
const MUA_CAO_DIEM = {
  name: 'Mua cao diem',
  batDauSauSoNgay: 60,
  soNgayKeoDai: 30,
  priceCents: 320_000_00,
  priority: 10,
};

/** Ngay ISO cach hom nay `soNgay` ngay, tinh theo UTC. */
function ngayIso(soNgay: number): string {
  const ngay = new Date();
  ngay.setUTCDate(ngay.getUTCDate() + soNgay);
  return ngay.toISOString().slice(0, 10);
}

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

    // Mua cao diem: gia suite tang, uu tien cao hon gia goc.
    await client.query(
      `insert into public.rate_plans (room_type_id, name, valid_range, price_cents, priority)
       select $1, $2, daterange($3::date, $4::date, '[)'), $5, $6
       where not exists (
         select 1 from public.rate_plans where room_type_id = $1 and name = $2
       )`,
      [
        roomTypeIds.suite,
        MUA_CAO_DIEM.name,
        ngayIso(MUA_CAO_DIEM.batDauSauSoNgay),
        ngayIso(MUA_CAO_DIEM.batDauSauSoNgay + MUA_CAO_DIEM.soNgayKeoDai),
        MUA_CAO_DIEM.priceCents,
        MUA_CAO_DIEM.priority,
      ],
    );

    // Doc lai tu database thay vi tra ve gia tri vua tinh: neu rate plan da ton
    // tai tu lan seed truoc, khoang ngay that su la cua lan do.
    const caoDiem = await client.query<{
      start_date: string;
      end_date: string;
      price_cents: string;
    }>(
      `select lower(valid_range)::text as start_date,
              upper(valid_range)::text as end_date,
              price_cents
       from public.rate_plans
       where room_type_id = $1 and name = $2`,
      [roomTypeIds.suite, MUA_CAO_DIEM.name],
    );
    const muaCaoDiem = {
      startDate: caoDiem.rows[0].start_date,
      endDate: caoDiem.rows[0].end_date,
      priceCents: Number(caoDiem.rows[0].price_cents),
    };

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
    log(`Mua cao diem cho suite: ${muaCaoDiem.startDate} den ${muaCaoDiem.endDate}.`);
    return { hotelId, roomTypeIds, roomIds, muaCaoDiem };
  } finally {
    await client.end();
  }
}

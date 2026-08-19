import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DatabaseService } from '../src/database/database.service';
import { seedDevData } from '../src/database/seed/dev-seed';
import {
  bearer,
  createTestApp,
  createTestUser,
  Fixtures,
  promoteToAdmin,
  resetDatabase,
  seedFixtures,
  TestUser,
} from './utils/test-app';

/**
 * Cac bat bien do DATABASE bao dam, khong phai do code TypeScript.
 * Go bo constraint trong migration thi cac test o day do, du toan bo ung dung
 * giu nguyen — giong cach double-booking.e2e-spec.ts canh giu R12.
 */
describe('Rang buoc o tang schema (e2e)', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let fixtures: Fixtures;
  let admin: TestUser;

  beforeAll(async () => {
    ({ app, database } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(database);
    fixtures = await seedFixtures(database);
    admin = createTestUser();
    await promoteToAdmin(database, admin);
  });

  describe('Row Level Security', () => {
    it('bat RLS tren moi bang cua schema public', async () => {
      const rows = await database.query<{ relname: string; relrowsecurity: boolean }>(
        `select relname, relrowsecurity
         from pg_class
         where relnamespace = 'public'::regnamespace
           and relkind = 'r'
         order by relname`,
      );

      const chuaBat = rows.filter((row) => !row.relrowsecurity).map((row) => row.relname);
      expect(chuaBat).toEqual([]);
      // Phong truong hop truy van tren tra ve rong ma van "pass".
      expect(rows.length).toBeGreaterThanOrEqual(7);
    });

    it('khong tao policy nao — mac dinh dong voi moi role khong phai chu so huu', async () => {
      const rows = await database.query<{ tablename: string }>(
        `select tablename from pg_policies where schemaname = 'public'`,
      );
      expect(rows).toEqual([]);
    });
  });

  describe('Loai phong phai cung khach san voi phong', () => {
    /** Tao mot khach san thu hai kem loai phong rieng cua no. */
    async function taoKhachSanKhac(): Promise<{ hotelId: string; roomTypeId: string }> {
      const hotel = await request(app.getHttpServer())
        .post('/api/hotels')
        .set('Authorization', bearer(admin))
        .send({ name: 'T_Hotel Hue', address: '1 Le Loi', city: 'Hue' })
        .expect(201);

      const roomType = await request(app.getHttpServer())
        .post('/api/room-types')
        .set('Authorization', bearer(admin))
        .send({
          hotelId: hotel.body.id,
          code: 'suite',
          name: 'Suite cua khach san Hue',
          capacity: 4,
          basePriceCents: 100_000_00,
        })
        .expect(201);

      return { hotelId: hotel.body.id, roomTypeId: roomType.body.id };
    }

    it('tu choi tao phong dung loai phong cua khach san khac (400)', async () => {
      const khac = await taoKhachSanKhac();

      await request(app.getHttpServer())
        .post('/api/rooms')
        .set('Authorization', bearer(admin))
        .send({
          hotelId: fixtures.hotelId,
          roomTypeId: khac.roomTypeId,
          roomNumber: '901',
        })
        .expect(400);
    });

    it('tu choi doi phong sang loai phong cua khach san khac (400)', async () => {
      const khac = await taoKhachSanKhac();

      await request(app.getHttpServer())
        .patch(`/api/rooms/${fixtures.doubleRoomId}`)
        .set('Authorization', bearer(admin))
        .send({ roomTypeId: khac.roomTypeId })
        .expect(400);
    });

    it('database chan truc tiep, khong phu thuoc tang ung dung', async () => {
      const khac = await taoKhachSanKhac();

      await expect(
        database.query(
          `insert into public.rooms (hotel_id, room_type_id, room_number) values ($1, $2, '902')`,
          [fixtures.hotelId, khac.roomTypeId],
        ),
      ).rejects.toMatchObject({ code: '23503' });
    });

    it('van cho tao phong khi loai phong dung khach san', async () => {
      await request(app.getHttpServer())
        .post('/api/rooms')
        .set('Authorization', bearer(admin))
        .send({
          hotelId: fixtures.hotelId,
          roomTypeId: fixtures.roomTypeIds.suite,
          roomNumber: '903',
        })
        .expect(201);
    });
  });

  describe('Seed idempotent', () => {
    it('chay seed nhieu lan khong sinh khach san trung', async () => {
      const connectionString = process.env.DATABASE_URL as string;
      await seedDevData({ connectionString });
      await seedDevData({ connectionString });

      const rows = await database.query<{ count: string }>(
        `select count(*)::text as count from public.hotels`,
      );
      expect(Number(rows[0].count)).toBe(1);

      const rooms = await database.query<{ count: string }>(
        `select count(*)::text as count from public.rooms`,
      );
      expect(Number(rooms[0].count)).toBe(5);
    });
  });
});

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DatabaseService } from '../src/database/database.service';
import {
  bearer,
  createTestApp,
  createTestUser,
  Fixtures,
  ngayTuHomNay,
  resetDatabase,
  seedFixtures,
} from './utils/test-app';

/**
 * R12 — bang chung chong double-booking.
 *
 * Day la test quan trong nhat cua giai doan 1. No phai that bai neu ai do go bo
 * exclusion constraint trong migration, ke ca khi toan bo code TypeScript giu nguyen.
 */
describe('Chong double-booking (e2e)', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let fixtures: Fixtures;

  beforeAll(async () => {
    ({ app, database } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(database);
    fixtures = await seedFixtures(database);
  });

  const bookingPayload = (checkIn: string, checkOut: string) => ({
    roomId: fixtures.doubleRoomId,
    checkIn,
    checkOut,
    guestName: 'Khach dat phong',
    guestEmail: 'khach@example.com',
  });

  it('hai request DONG THOI cung phong cung khoang ngay: dung mot cai thanh cong', async () => {
    const firstUser = createTestUser();
    const secondUser = createTestUser();

    // Goi profile truoc de viec tu tao ho so khong lam lech thoi diem hai
    // request cham vao bang bookings.
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', bearer(firstUser))
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', bearer(secondUser))
      .expect(200);

    const payload = bookingPayload(ngayTuHomNay(100), ngayTuHomNay(104));

    const responses = await Promise.all([
      request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', bearer(firstUser))
        .send(payload),
      request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', bearer(secondUser))
        .send(payload),
    ]);

    const statuses = responses.map((response) => response.status).sort();
    expect(statuses).toEqual([201, 409]);

    const rows = await database.query<{ count: string }>(
      `select count(*)::text as count from public.bookings
       where room_id = $1 and status <> 'cancelled'`,
      [fixtures.doubleRoomId],
    );
    expect(Number(rows[0].count)).toBe(1);
  });

  it('nam request dong thoi cho cung phong: chi mot cai duoc ghi', async () => {
    const payload = bookingPayload(ngayTuHomNay(110), ngayTuHomNay(114));

    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app.getHttpServer())
          .post('/api/bookings')
          .set('Authorization', bearer(createTestUser()))
          .send(payload),
      ),
    );

    const created = responses.filter((response) => response.status === 201);
    const conflicted = responses.filter((response) => response.status === 409);

    expect(created).toHaveLength(1);
    expect(conflicted).toHaveLength(4);
  });

  it('tu choi khoang ngay chong lan mot phan (409)', async () => {
    const user = createTestUser();

    await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', bearer(user))
      .send(bookingPayload(ngayTuHomNay(130), ngayTuHomNay(135)))
      .expect(201);

    // Chong lan phan duoi
    await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', bearer(createTestUser()))
      .send(bookingPayload(ngayTuHomNay(128), ngayTuHomNay(131)))
      .expect(409);

    // Chong lan phan tren
    await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', bearer(createTestUser()))
      .send(bookingPayload(ngayTuHomNay(134), ngayTuHomNay(140)))
      .expect(409);

    // Nam gon ben trong
    await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', bearer(createTestUser()))
      .send(bookingPayload(ngayTuHomNay(131), ngayTuHomNay(133)))
      .expect(409);

    // Bao trum ben ngoai (dung 30 dem, sat gioi han MAX_STAY_NIGHTS)
    await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', bearer(createTestUser()))
      .send(bookingPayload(ngayTuHomNay(121), ngayTuHomNay(151)))
      .expect(409);
  });

  it('cho phep khach moi nhan phong dung ngay khach cu tra phong', async () => {
    await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', bearer(createTestUser()))
      .send(bookingPayload(ngayTuHomNay(160), ngayTuHomNay(165)))
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', bearer(createTestUser()))
      .send(bookingPayload(ngayTuHomNay(165), ngayTuHomNay(168)))
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', bearer(createTestUser()))
      .send(bookingPayload(ngayTuHomNay(157), ngayTuHomNay(160)))
      .expect(201);
  });

  it('hai transaction song song o tang database: cai thu hai nhan SQLSTATE 23P01', async () => {
    // Test nay bo qua toan bo tang HTTP de chung minh rang bao ve nam o DATABASE,
    // khong phai o code ung dung.
    const userId = createTestUser().id;
    const insert = `
      insert into public.bookings
        (room_id, user_id, guest_name, guest_email, check_in, check_out, total_price_cents, status)
      values ($1, $2, 'A', 'a@example.com', '${ngayTuHomNay(180)}'::date, '${ngayTuHomNay(184)}'::date, 100, 'confirmed')
    `;

    const errors: { code?: string }[] = [];
    let secondAttempt: Promise<void> = Promise.resolve();

    await database.transaction(async (firstClient) => {
      await firstClient.query(insert, [fixtures.doubleRoomId, userId]);

      // Transaction thu hai chay tren connection khac, trong khi transaction thu
      // nhat CHUA commit. Postgres cho no doi tai index cua exclusion constraint.
      // KHONG await o day: neu doi ngay bay gio thi transaction thu nhat khong bao
      // gio commit duoc va ca hai treo nhau.
      secondAttempt = database
        .transaction(async (secondClient) => {
          await secondClient.query(insert, [fixtures.doubleRoomId, userId]);
        })
        .catch((error: { code?: string }) => {
          errors.push(error);
        });

      // Cho mot nhip de chac chan transaction thu hai da bi chan, roi moi commit.
      await new Promise((resolve) => setTimeout(resolve, 300));
    });

    await secondAttempt;

    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe('23P01');
  });
});

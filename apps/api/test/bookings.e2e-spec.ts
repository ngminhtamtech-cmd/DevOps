import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DatabaseService } from '../src/database/database.service';
import {
  bearer,
  createTestApp,
  createTestUser,
  Fixtures,
  ngayTuHomNay,
  promoteToAdmin,
  resetDatabase,
  seedFixtures,
  TestUser,
} from './utils/test-app';

describe('Luong dat phong (e2e)', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let fixtures: Fixtures;
  let customer: TestUser;

  beforeAll(async () => {
    ({ app, database } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(database);
    fixtures = await seedFixtures(database);
    customer = createTestUser();
  });

  const NHAN_PHONG = ngayTuHomNay(10);
  const TRA_PHONG = ngayTuHomNay(13);

  const validBooking = (overrides: Record<string, unknown> = {}) => ({
    roomId: fixtures.doubleRoomId,
    checkIn: NHAN_PHONG,
    checkOut: TRA_PHONG,
    guestName: 'Nguyen Van A',
    guestEmail: 'a@example.com',
    ...overrides,
  });

  it('tao booking thanh cong va tinh dung tong tien', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', bearer(customer))
      .send(validBooking())
      .expect(201);

    expect(response.body).toMatchObject({
      roomId: fixtures.doubleRoomId,
      userId: customer.id,
      status: 'confirmed',
      nights: 3,
      // phong doi: 95.000 xu/dem x 3 dem
      totalPriceCents: 3 * 95_000_00,
    });
    expect(response.body.checkIn).toBe(NHAN_PHONG);
    expect(response.body.checkOut).toBe(TRA_PHONG);
  });

  it('bat buoc dang nhap (401)', async () => {
    await request(app.getHttpServer()).post('/api/bookings').send(validBooking()).expect(401);
  });

  it('tu choi ngay khong hop le va email sai dinh dang (400)', async () => {
    // Ngay tra phong trung ngay nhan phong = khong co dem nao.
    await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', bearer(customer))
      .send(validBooking({ checkOut: NHAN_PHONG }))
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', bearer(customer))
      .send(validBooking({ guestEmail: 'khong-phai-email' }))
      .expect(400);

    // Dai hon gioi han 30 dem moi lan dat.
    await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', bearer(customer))
      .send(validBooking({ checkIn: ngayTuHomNay(10), checkOut: ngayTuHomNay(60) }))
      .expect(400);
  });

  it('tu choi dat phong cho ngay da qua (400)', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', bearer(customer))
      .send(validBooking({ checkIn: ngayTuHomNay(-3), checkOut: ngayTuHomNay(-1) }))
      .expect(400);

    expect(response.body.message).toContain('ngay da qua');
  });

  it('cho phep dat phong bat dau ngay hom nay', async () => {
    await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', bearer(customer))
      .send(validBooking({ checkIn: ngayTuHomNay(0), checkOut: ngayTuHomNay(2) }))
      .expect(201);
  });

  it('tra 404 khi phong khong ton tai', async () => {
    await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', bearer(customer))
      .send(validBooking({ roomId: '00000000-0000-4000-8000-000000000000' }))
      .expect(404);
  });

  it('tu choi dat phong dang bao tri (409)', async () => {
    await database.query('update public.rooms set status = $2 where id = $1', [
      fixtures.doubleRoomId,
      'maintenance',
    ]);

    await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', bearer(customer))
      .send(validBooking())
      .expect(409);
  });

  it('chi tra ve booking cua chinh minh trong /bookings/me', async () => {
    const otherCustomer = createTestUser();

    await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', bearer(customer))
      .send(validBooking())
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', bearer(otherCustomer))
      .send(validBooking({ roomId: fixtures.roomIds[0] }))
      .expect(201);

    const mine = await request(app.getHttpServer())
      .get('/api/bookings/me')
      .set('Authorization', bearer(customer))
      .expect(200);

    expect(mine.body).toHaveLength(1);
    expect(mine.body[0].userId).toBe(customer.id);
  });

  it('chan khach xem booking cua nguoi khac (403) nhung cho admin xem (200)', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', bearer(customer))
      .send(validBooking())
      .expect(201);

    const stranger = createTestUser();
    await request(app.getHttpServer())
      .get(`/api/bookings/${created.body.id}`)
      .set('Authorization', bearer(stranger))
      .expect(403);

    const admin = createTestUser();
    await promoteToAdmin(database, admin);
    await request(app.getHttpServer())
      .get(`/api/bookings/${created.body.id}`)
      .set('Authorization', bearer(admin))
      .expect(200);
  });

  it('huy booking va cho phep dat lai dung khoang ngay do', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', bearer(customer))
      .send(validBooking())
      .expect(201);

    const cancelled = await request(app.getHttpServer())
      .post(`/api/bookings/${created.body.id}/cancel`)
      .set('Authorization', bearer(customer))
      .expect(200);
    expect(cancelled.body.status).toBe('cancelled');
    expect(cancelled.body.cancelledAt).not.toBeNull();

    await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', bearer(createTestUser()))
      .send(validBooking())
      .expect(201);
  });

  it('huy hai lan dong thoi chi ghi cancelled_at mot lan', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', bearer(customer))
      .send(validBooking())
      .expect(201);

    const cancel = () =>
      request(app.getHttpServer())
        .post(`/api/bookings/${created.body.id}/cancel`)
        .set('Authorization', bearer(customer));

    const [first, second] = await Promise.all([cancel(), cancel()]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body.status).toBe('cancelled');
    expect(second.body.status).toBe('cancelled');
    // Ca hai deu tra ve cung mot moc thoi gian: chi mot request thuc su ghi.
    expect(first.body.cancelledAt).toBe(second.body.cancelledAt);
  });
});

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
  themNgay,
  TestUser,
} from './utils/test-app';

describe('Kiem tra ton phong theo khoang ngay (e2e)', () => {
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

  const book = (roomId: string, checkIn: string, checkOut: string) =>
    request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', bearer(customer))
      .send({
        roomId,
        checkIn,
        checkOut,
        guestName: 'Nguyen Van A',
        guestEmail: 'a@example.com',
      });

  it('tra ve moi phong khi chua co booking nao', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/availability')
      .query({ checkIn: ngayTuHomNay(20), checkOut: ngayTuHomNay(23) })
      .expect(200);

    expect(response.body).toHaveLength(5);
    expect(response.body[0].nights).toBe(3);
  });

  it('loai phong da co booking chong lan khoang ngay tim kiem', async () => {
    await book(fixtures.doubleRoomId, ngayTuHomNay(20), ngayTuHomNay(24)).expect(201);

    const response = await request(app.getHttpServer())
      .get('/api/availability')
      .query({ checkIn: ngayTuHomNay(22), checkOut: ngayTuHomNay(25) })
      .expect(200);

    const ids = response.body.map((room: { id: string }) => room.id);
    expect(ids).not.toContain(fixtures.doubleRoomId);
    expect(ids).toHaveLength(4);
  });

  it('van tra ve phong khi ngay nhan trung ngay tra cua booking truoc', async () => {
    await book(fixtures.doubleRoomId, ngayTuHomNay(20), ngayTuHomNay(24)).expect(201);

    const response = await request(app.getHttpServer())
      .get('/api/availability')
      .query({ checkIn: ngayTuHomNay(24), checkOut: ngayTuHomNay(27) })
      .expect(200);

    const ids = response.body.map((room: { id: string }) => room.id);
    expect(ids).toContain(fixtures.doubleRoomId);
  });

  it('tra lai phong vao kho sau khi booking bi huy', async () => {
    const created = await book(
      fixtures.doubleRoomId,
      ngayTuHomNay(20),
      ngayTuHomNay(24),
    ).expect(201);

    await request(app.getHttpServer())
      .post(`/api/bookings/${created.body.id}/cancel`)
      .set('Authorization', bearer(customer))
      .expect(200);

    const response = await request(app.getHttpServer())
      .get('/api/availability')
      .query({ checkIn: ngayTuHomNay(20), checkOut: ngayTuHomNay(24) })
      .expect(200);

    const ids = response.body.map((room: { id: string }) => room.id);
    expect(ids).toContain(fixtures.doubleRoomId);
  });

  it('loc theo suc chua', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/availability')
      .query({ checkIn: ngayTuHomNay(20), checkOut: ngayTuHomNay(22), guests: 3 })
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0].roomTypeCode).toBe('suite');
  });

  it('bo qua phong dang bao tri', async () => {
    await database.query('update public.rooms set status = $2 where id = $1', [
      fixtures.doubleRoomId,
      'maintenance',
    ]);

    const response = await request(app.getHttpServer())
      .get('/api/availability')
      .query({ checkIn: ngayTuHomNay(40), checkOut: ngayTuHomNay(42) })
      .expect(200);

    const ids = response.body.map((room: { id: string }) => room.id);
    expect(ids).not.toContain(fixtures.doubleRoomId);
  });

  it('tinh gia theo mua: dat trong mua cao diem dat hon ngoai mua', async () => {
    const suiteRoom = await database.queryOne<{ id: string }>(
      `select r.id from public.rooms r
       join public.room_types rt on rt.id = r.room_type_id
       where rt.code = 'suite' limit 1`,
    );

    // Khoang ngay lay tu chinh rate plan da seed, khong viet cung trong test.
    const caoDiem = await request(app.getHttpServer())
      .get('/api/availability')
      .query({
        checkIn: fixtures.muaCaoDiem.startDate,
        checkOut: themNgay(fixtures.muaCaoDiem.startDate, 2),
        roomTypeId: fixtures.roomTypeIds.suite,
      })
      .expect(200);

    // Sau khi mua cao diem ket thuc thi ve lai gia goc.
    const ngoaiMua = await request(app.getHttpServer())
      .get('/api/availability')
      .query({
        checkIn: themNgay(fixtures.muaCaoDiem.endDate, 5),
        checkOut: themNgay(fixtures.muaCaoDiem.endDate, 7),
        roomTypeId: fixtures.roomTypeIds.suite,
      })
      .expect(200);

    expect(caoDiem.body[0].id).toBe(suiteRoom?.id);
    // 2 dem cao diem = 2 x 320.000 xu; 2 dem thuong = 2 x 210.000 xu
    expect(caoDiem.body[0].totalPriceCents).toBe(2 * fixtures.muaCaoDiem.priceCents);
    expect(ngoaiMua.body[0].totalPriceCents).toBe(2 * 210_000_00);
  });

  it('tu choi khoang ngay khong hop le (400)', async () => {
    await request(app.getHttpServer())
      .get('/api/availability')
      .query({ checkIn: ngayTuHomNay(25), checkOut: ngayTuHomNay(20) })
      .expect(400);

    await request(app.getHttpServer())
      .get('/api/availability')
      .query({ checkIn: '2026-02-30', checkOut: '2026-03-05' })
      .expect(400);

    await request(app.getHttpServer())
      .get('/api/availability')
      .query({ checkIn: ngayTuHomNay(20) })
      .expect(400);
  });

  it('van tra cuu duoc gia cua khoang ngay trong qua khu', async () => {
    // Tim kiem khong bi rang buoc "khong dat ngay qua khu" nhu luc tao booking:
    // xem lai gia va tinh trang mot khoang ngay da qua la viec hop le.
    await request(app.getHttpServer())
      .get('/api/availability')
      .query({ checkIn: ngayTuHomNay(-10), checkOut: ngayTuHomNay(-8) })
      .expect(200);
  });
});

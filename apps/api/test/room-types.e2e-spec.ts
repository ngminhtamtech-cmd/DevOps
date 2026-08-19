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

/** Loai phong va gia theo mua — phan trang admin cua giai doan 2 se dua vao. */
describe('Loai phong va rate plan (e2e)', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let fixtures: Fixtures;
  let admin: TestUser;
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
    admin = createTestUser();
    await promoteToAdmin(database, admin);
    customer = createTestUser();
  });

  it('liet ke loai phong cong khai theo khach san, sap theo gia goc', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/room-types')
      .query({ hotelId: fixtures.hotelId })
      .expect(200);

    expect(response.body).toHaveLength(3);
    const gia = response.body.map((rt: { basePriceCents: number }) => rt.basePriceCents);
    expect(gia).toEqual([...gia].sort((a, b) => a - b));
  });

  it('doi hoi hotelId hop le khi liet ke (400)', async () => {
    await request(app.getHttpServer()).get('/api/room-types').expect(400);
    await request(app.getHttpServer())
      .get('/api/room-types')
      .query({ hotelId: 'khong-phai-uuid' })
      .expect(400);
  });

  it('admin tao loai phong moi cho khach san khac', async () => {
    // Khach san trong seed da co du ba ma, nen tao o mot khach san moi.
    const hotel = await request(app.getHttpServer())
      .post('/api/hotels')
      .set('Authorization', bearer(admin))
      .send({ name: 'T_Hotel Hoi An', address: '5 Bach Dang', city: 'Hoi An' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/api/room-types')
      .set('Authorization', bearer(admin))
      .send({
        hotelId: hotel.body.id,
        code: 'single',
        name: 'Phong don view pho',
        capacity: 1,
        basePriceCents: 55_000_00,
      })
      .expect(201);

    expect(response.body).toMatchObject({ code: 'single', capacity: 1, basePriceCents: 55_000_00 });
  });

  it('tra 404 khi tao loai phong cho khach san khong ton tai', async () => {
    await request(app.getHttpServer())
      .post('/api/room-types')
      .set('Authorization', bearer(admin))
      .send({
        hotelId: '00000000-0000-4000-8000-000000000000',
        code: 'single',
        name: 'Khong co chu',
        capacity: 1,
        basePriceCents: 10_000_00,
      })
      .expect(404);
  });

  it('tu choi loai phong trung ma trong cung khach san (409)', async () => {
    await request(app.getHttpServer())
      .post('/api/room-types')
      .set('Authorization', bearer(admin))
      .send({
        hotelId: fixtures.hotelId,
        code: 'suite',
        name: 'Suite thu hai',
        capacity: 4,
        basePriceCents: 300_000_00,
      })
      .expect(409);
  });

  it('tu choi ma loai phong ngoai danh sach cho phep (400)', async () => {
    await request(app.getHttpServer())
      .post('/api/room-types')
      .set('Authorization', bearer(admin))
      .send({
        hotelId: fixtures.hotelId,
        code: 'penthouse',
        name: 'Penthouse',
        capacity: 6,
        basePriceCents: 900_000_00,
      })
      .expect(400);
  });

  it('chan customer tao loai phong va rate plan (403)', async () => {
    await request(app.getHttpServer())
      .post('/api/room-types')
      .set('Authorization', bearer(customer))
      .send({
        hotelId: fixtures.hotelId,
        code: 'single',
        name: 'Khong duoc phep',
        capacity: 1,
        basePriceCents: 10_000_00,
      })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/room-types/${fixtures.roomTypeIds.suite}/rate-plans`)
      .set('Authorization', bearer(customer))
      .send({
        name: 'Khong duoc phep',
        startDate: ngayTuHomNay(10),
        endDate: ngayTuHomNay(20),
        priceCents: 1,
      })
      .expect(403);
  });

  it('admin tao rate plan va no doi gia tim phong ngay lap tuc', async () => {
    const batDau = ngayTuHomNay(300);
    const ketThuc = ngayTuHomNay(310);

    const truocKhiTao = await request(app.getHttpServer())
      .get('/api/availability')
      .query({ checkIn: batDau, checkOut: ngayTuHomNay(302), roomTypeId: fixtures.roomTypeIds.double })
      .expect(200);
    expect(truocKhiTao.body[0].totalPriceCents).toBe(2 * 95_000_00);

    await request(app.getHttpServer())
      .post(`/api/room-types/${fixtures.roomTypeIds.double}/rate-plans`)
      .set('Authorization', bearer(admin))
      .send({
        name: 'Le hoi phao hoa',
        startDate: batDau,
        endDate: ketThuc,
        priceCents: 150_000_00,
        priority: 20,
      })
      .expect(201);

    const sauKhiTao = await request(app.getHttpServer())
      .get('/api/availability')
      .query({ checkIn: batDau, checkOut: ngayTuHomNay(302), roomTypeId: fixtures.roomTypeIds.double })
      .expect(200);
    expect(sauKhiTao.body[0].totalPriceCents).toBe(2 * 150_000_00);
  });

  it('rate plan priority cao hon thang khi hai khoang chong nhau', async () => {
    const batDau = ngayTuHomNay(320);

    for (const [name, priceCents, priority] of [
      ['Uu tien thap', 120_000_00, 1],
      ['Uu tien cao', 180_000_00, 50],
    ] as const) {
      await request(app.getHttpServer())
        .post(`/api/room-types/${fixtures.roomTypeIds.double}/rate-plans`)
        .set('Authorization', bearer(admin))
        .send({ name, startDate: batDau, endDate: ngayTuHomNay(330), priceCents, priority })
        .expect(201);
    }

    const response = await request(app.getHttpServer())
      .get('/api/availability')
      .query({ checkIn: batDau, checkOut: ngayTuHomNay(321), roomTypeId: fixtures.roomTypeIds.double })
      .expect(200);

    expect(response.body[0].totalPriceCents).toBe(180_000_00);
  });

  it('tu choi rate plan co endDate khong sau startDate (400)', async () => {
    await request(app.getHttpServer())
      .post(`/api/room-types/${fixtures.roomTypeIds.suite}/rate-plans`)
      .set('Authorization', bearer(admin))
      .send({
        name: 'Khoang rong',
        startDate: ngayTuHomNay(40),
        endDate: ngayTuHomNay(40),
        priceCents: 100_000_00,
      })
      .expect(400);
  });

  it('tra 404 khi tao rate plan cho loai phong khong ton tai', async () => {
    await request(app.getHttpServer())
      .post('/api/room-types/00000000-0000-4000-8000-000000000000/rate-plans')
      .set('Authorization', bearer(admin))
      .send({
        name: 'Khong co chu',
        startDate: ngayTuHomNay(10),
        endDate: ngayTuHomNay(20),
        priceCents: 100_000_00,
      })
      .expect(404);
  });

  it('liet ke rate plan cong khai, tra ve dung khoang ngay da seed', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/room-types/${fixtures.roomTypeIds.suite}/rate-plans`)
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({
      startDate: fixtures.muaCaoDiem.startDate,
      endDate: fixtures.muaCaoDiem.endDate,
      priceCents: fixtures.muaCaoDiem.priceCents,
    });
  });
});

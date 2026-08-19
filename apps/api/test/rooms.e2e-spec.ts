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

describe('CRUD phong (e2e)', () => {
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

  it('liet ke phong cong khai va loc theo loai phong', async () => {
    const all = await request(app.getHttpServer()).get('/api/rooms').expect(200);
    expect(all.body).toHaveLength(5);

    const doubles = await request(app.getHttpServer())
      .get('/api/rooms')
      .query({ roomTypeId: fixtures.roomTypeIds.double })
      .expect(200);
    expect(doubles.body).toHaveLength(2);
    expect(doubles.body.every((room: { roomTypeId: string }) => room.roomTypeId === fixtures.roomTypeIds.double)).toBe(true);
  });

  it('admin tao phong moi', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/rooms')
      .set('Authorization', bearer(admin))
      .send({
        hotelId: fixtures.hotelId,
        roomTypeId: fixtures.roomTypeIds.single,
        roomNumber: '103',
        floor: 1,
      })
      .expect(201);

    expect(response.body).toMatchObject({ roomNumber: '103', status: 'available', floor: 1 });
  });

  it('tu choi phong trung so trong cung khach san (409)', async () => {
    await request(app.getHttpServer())
      .post('/api/rooms')
      .set('Authorization', bearer(admin))
      .send({
        hotelId: fixtures.hotelId,
        roomTypeId: fixtures.roomTypeIds.single,
        roomNumber: '101',
      })
      .expect(409);
  });

  it('tu choi payload sai dinh dang (400) va truong la (400)', async () => {
    await request(app.getHttpServer())
      .post('/api/rooms')
      .set('Authorization', bearer(admin))
      .send({ hotelId: 'khong-phai-uuid', roomTypeId: fixtures.roomTypeIds.single, roomNumber: '104' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/rooms')
      .set('Authorization', bearer(admin))
      .send({
        hotelId: fixtures.hotelId,
        roomTypeId: fixtures.roomTypeIds.single,
        roomNumber: '105',
        truongLa: 'gia tri bat ngo',
      })
      .expect(400);
  });

  it('customer khong duoc tao, sua hay xoa phong (403)', async () => {
    await request(app.getHttpServer())
      .post('/api/rooms')
      .set('Authorization', bearer(customer))
      .send({
        hotelId: fixtures.hotelId,
        roomTypeId: fixtures.roomTypeIds.single,
        roomNumber: '106',
      })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/api/rooms/${fixtures.doubleRoomId}`)
      .set('Authorization', bearer(customer))
      .send({ status: 'maintenance' })
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/rooms/${fixtures.doubleRoomId}`)
      .set('Authorization', bearer(customer))
      .expect(403);
  });

  it('tu choi PATCH khong co truong nao de cap nhat (400)', async () => {
    await request(app.getHttpServer())
      .patch(`/api/rooms/${fixtures.doubleRoomId}`)
      .set('Authorization', bearer(admin))
      .send({})
      .expect(400);
  });

  it('tu choi xoa phong da co booking (409) va goi y doi sang maintenance', async () => {
    await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', bearer(customer))
      .send({
        roomId: fixtures.doubleRoomId,
        checkIn: ngayTuHomNay(15),
        checkOut: ngayTuHomNay(17),
        guestName: 'Nguyen Van A',
        guestEmail: 'a@example.com',
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .delete(`/api/rooms/${fixtures.doubleRoomId}`)
      .set('Authorization', bearer(admin))
      .expect(409);

    expect(response.body.message).toContain('maintenance');
  });

  it('admin doi trang thai phong sang maintenance roi xoa phong chua co booking', async () => {
    const updated = await request(app.getHttpServer())
      .patch(`/api/rooms/${fixtures.doubleRoomId}`)
      .set('Authorization', bearer(admin))
      .send({ status: 'maintenance' })
      .expect(200);
    expect(updated.body.status).toBe('maintenance');

    await request(app.getHttpServer())
      .delete(`/api/rooms/${fixtures.doubleRoomId}`)
      .set('Authorization', bearer(admin))
      .expect(204);

    await request(app.getHttpServer()).get(`/api/rooms/${fixtures.doubleRoomId}`).expect(404);
  });
});

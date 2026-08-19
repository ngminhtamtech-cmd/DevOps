import { INestApplication } from '@nestjs/common';
import { sign } from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { DatabaseService } from '../src/database/database.service';
import {
  bearer,
  createTestApp,
  createTestUser,
  promoteToAdmin,
  resetDatabase,
} from './utils/test-app';

describe('Xac thuc va phan quyen (e2e)', () => {
  let app: INestApplication;
  let database: DatabaseService;

  beforeAll(async () => {
    ({ app, database } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(database);
  });

  it('cho phep goi endpoint cong khai khi khong co token', async () => {
    await request(app.getHttpServer()).get('/api/health').expect(200);
    await request(app.getHttpServer()).get('/api/hotels').expect(200);
  });

  it('tra 401 khi thieu Authorization', async () => {
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);
  });

  it('tra 401 khi token ky bang secret khac', async () => {
    const forged = sign({ sub: randomUUID() }, 'secret-gia-mao-cua-ke-tan-cong-123456', {
      algorithm: 'HS256',
      audience: 'authenticated',
      expiresIn: 3600,
    });

    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${forged}`)
      .expect(401);
  });

  it('tra 401 khi token het han', async () => {
    const user = createTestUser({ expiresIn: -10 });

    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', bearer(user))
      .expect(401);
  });

  it('tu tao profile role customer trong lan goi API dau tien', async () => {
    const user = createTestUser();

    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', bearer(user))
      .expect(200);

    expect(response.body).toEqual({ id: user.id, email: user.email, role: 'customer' });

    const profiles = await database.query('select id from public.profiles where id = $1', [user.id]);
    expect(profiles).toHaveLength(1);
  });

  it('chan customer goi endpoint danh cho admin (403)', async () => {
    const customer = createTestUser();

    await request(app.getHttpServer())
      .post('/api/hotels')
      .set('Authorization', bearer(customer))
      .send({ name: 'Khach san moi', address: '1 Tran Phu', city: 'Hue' })
      .expect(403);
  });

  it('cho admin goi endpoint danh cho admin (201)', async () => {
    const admin = createTestUser();
    await promoteToAdmin(database, admin);

    const response = await request(app.getHttpServer())
      .post('/api/hotels')
      .set('Authorization', bearer(admin))
      .send({ name: 'Khach san moi', address: '1 Tran Phu', city: 'Hue' })
      .expect(201);

    expect(response.body.name).toBe('Khach san moi');
  });
});

import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { sign } from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/bootstrap';
import { DatabaseService } from '../../src/database/database.service';
import { seedDevData } from '../../src/database/seed/dev-seed';

export interface TestContext {
  app: INestApplication;
  database: DatabaseService;
}

export async function createTestApp(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

  const app = moduleRef.createNestApplication();
  configureApp(app, ['http://localhost:3000']);

  // Dung listen(0) (cong ngau nhien) thay vi init(): test dat phong dong thoi
  // ban hai request song song, ma Supertest se tranh nhau goi listen neu server
  // chua mo cong. Mo san mot lan o day thi khong con canh tranh.
  await app.listen(0);

  return { app, database: app.get(DatabaseService) };
}

/**
 * Xoa sach du lieu nghiep vu giua cac test.
 * TRUNCATE ... CASCADE nhanh hon DELETE va reset ca cac bang phu thuoc,
 * nhung KHONG dung cho schema_migrations — schema phai giu nguyen.
 */
export async function resetDatabase(database: DatabaseService): Promise<void> {
  await database.query(
    'truncate table public.bookings, public.rate_plans, public.rooms, public.room_types, public.hotels, public.profiles restart identity cascade',
  );
}

export interface Fixtures {
  hotelId: string;
  roomTypeIds: Record<string, string>;
  roomIds: string[];
  /** Phong doi dau tien — dung cho phan lon test dat phong. */
  doubleRoomId: string;
}

export async function seedFixtures(database: DatabaseService): Promise<Fixtures> {
  const connectionString = process.env.DATABASE_URL as string;
  const seeded = await seedDevData({ connectionString });

  const doubleRoom = await database.queryOne<{ id: string }>(
    `select r.id from public.rooms r
     join public.room_types rt on rt.id = r.room_type_id
     where rt.code = 'double'
     order by r.room_number
     limit 1`,
  );

  return { ...seeded, doubleRoomId: (doubleRoom as { id: string }).id };
}

export interface TestUser {
  id: string;
  email: string;
  accessToken: string;
}

/**
 * Tao access token giong het token that cua Supabase Auth: HS256, aud
 * 'authenticated', sub la user id. Test khong goi Supabase that vi giai doan 1
 * chi kiem chung viec API XAC MINH token, con viec phat hanh la cua Supabase.
 */
export function createTestUser(overrides: Partial<{ id: string; email: string; expiresIn: number }> = {}): TestUser {
  const id = overrides.id ?? randomUUID();
  const email = overrides.email ?? `user-${id.slice(0, 8)}@example.com`;
  const secret = process.env.SUPABASE_JWT_SECRET as string;

  const accessToken = sign({ sub: id, email, role: 'authenticated' }, secret, {
    algorithm: 'HS256',
    audience: 'authenticated',
    expiresIn: overrides.expiresIn ?? 3600,
  });

  return { id, email, accessToken };
}

/** Nang mot user len admin bang cach doi role trong public.profiles. */
export async function promoteToAdmin(database: DatabaseService, user: TestUser): Promise<void> {
  await database.query(
    `insert into public.profiles (id, email, role)
     values ($1, $2, 'admin')
     on conflict (id) do update set role = 'admin'`,
    [user.id, user.email],
  );
}

export function bearer(user: TestUser): string {
  return `Bearer ${user.accessToken}`;
}

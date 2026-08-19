/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Mot lenh duy nhat de dung ca moi truong dev: `npm run dev` o thu muc goc.
 *
 * Truoc day phai mo ba terminal (Postgres, migrate + seed + API, smoke test).
 * Script nay lam tuan tu trong MOT tien trinh:
 *   1. Dung Postgres cuc bo (bo qua neu DATABASE_URL tro ra ngoai, vd. Supabase)
 *   2. Chay migration
 *   3. Seed du lieu mau, gan san mot tai khoan admin
 *   4. Khoi dong API
 *   5. In san token admin va token khach de thu ngay bang curl
 *
 * Ctrl+C dong ca API lan Postgres. Chi danh cho dev — tu choi chay khi
 * NODE_ENV=production.
 */
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');

require('dotenv').config({ path: ['.env', '../../.env'] });

const API_ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(API_ROOT, '.local-pg');
const ENV_FILE = path.join(API_ROOT, '.env');

/**
 * Id co dinh cho hai tai khoan dev. Co dinh chu khong random de token in ra o
 * lan chay truoc van con dung o lan chay sau.
 */
const DEV_ADMIN_ID = 'a0000000-0000-4000-8000-000000000001';
const DEV_KHACH_ID = 'c0000000-0000-4000-8000-000000000002';

const DEFAULT_DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:55432/postgres';

function log(message) {
  console.log(message);
}

/** Tao .env toi thieu neu chua co, de lenh nay chay duoc ngay sau khi clone. */
function damBaoEnv() {
  if (fs.existsSync(ENV_FILE)) {
    return;
  }
  const secret = require('node:crypto').randomBytes(32).toString('hex');
  fs.writeFileSync(
    ENV_FILE,
    [
      '# File nay do scripts/dev-up.js tu tao cho moi truong dev cuc bo.',
      '# Khong commit (.gitignore da chan). Doi DATABASE_URL sang Supabase khi can.',
      'NODE_ENV=development',
      'PORT=3001',
      '',
      `DATABASE_URL=${DEFAULT_DATABASE_URL}`,
      'DATABASE_SSL=false',
      'DATABASE_POOL_MAX=10',
      '',
      `SUPABASE_JWT_SECRET=${secret}`,
      '',
      'CORS_ORIGINS=http://localhost:3000',
      '',
    ].join('\n'),
    'utf8',
  );
  log(`Da tao ${ENV_FILE} voi cau hinh dev mac dinh.`);
  require('dotenv').config({ path: ENV_FILE, override: true });
}

/** Cong da co nguoi nghe chua. Dung de biet Postgres da chay san hay chua. */
function congDangBiChiem(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: '127.0.0.1' });
    const xong = (ketQua) => {
      socket.destroy();
      resolve(ketQua);
    };
    socket.setTimeout(1000);
    socket.on('connect', () => xong(true));
    socket.on('error', () => xong(false));
    socket.on('timeout', () => xong(false));
  });
}

/** Chi dung Postgres cuc bo khi DATABASE_URL tro ve chinh may nay. */
function laDatabaseCucBo(url) {
  const host = new URL(url).hostname;
  return host === '127.0.0.1' || host === 'localhost' || host === '::1';
}

async function dungPostgresCucBo(url) {
  const port = Number(new URL(url).port || 5432);

  if (await congDangBiChiem(port)) {
    log(`Postgres da chay san o cong ${port}, dung lai cai do.`);
    return null;
  }

  const imported = require('embedded-postgres');
  const EmbeddedPostgres = imported.default || imported;

  const postgres = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: 'postgres',
    password: 'postgres',
    port,
    persistent: true,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    onLog: () => undefined,
    onError: () => undefined,
  });

  if (!fs.existsSync(DATA_DIR)) {
    log('Lan dau chay: dang khoi tao cluster Postgres (mat vai chuc giay)...');
    await postgres.initialise();
  }

  await postgres.start();
  log(`Postgres cuc bo dang chay o cong ${port}.`);
  return postgres;
}

function taoToken(userId, email) {
  const { sign } = require('jsonwebtoken');
  return sign({ sub: userId, email, role: 'authenticated' }, process.env.SUPABASE_JWT_SECRET, {
    algorithm: 'HS256',
    audience: 'authenticated',
    expiresIn: '12h',
  });
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('dev-up chi danh cho moi truong dev, khong chay tren production.');
  }

  damBaoEnv();

  const databaseUrl = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
  process.env.DATABASE_URL = databaseUrl;

  const postgres = laDatabaseCucBo(databaseUrl) ? await dungPostgresCucBo(databaseUrl) : null;
  if (!postgres && !laDatabaseCucBo(databaseUrl)) {
    log(`DATABASE_URL tro ra ngoai may (${new URL(databaseUrl).hostname}), bo qua Postgres cuc bo.`);
  }

  // ts-node cho phep dung thang code TypeScript trong src, khong can build truoc.
  require('ts-node').register({
    transpileOnly: true,
    compilerOptions: { module: 'commonjs' },
  });

  const { runMigrations } = require('../src/database/migration-runner');
  const ketQua = await runMigrations({
    connectionString: databaseUrl,
    ssl: process.env.DATABASE_SSL === 'true',
    log,
  });
  log(`Migration: chay moi ${ketQua.applied.length}, bo qua ${ketQua.skipped.length} cai da co.`);

  const { seedDevData } = require('../src/database/seed/dev-seed');
  const seed = await seedDevData({
    connectionString: databaseUrl,
    ssl: process.env.DATABASE_SSL === 'true',
    adminUserId: DEV_ADMIN_ID,
    adminEmail: 'admin@t-hotel.local',
    log,
  });

  const { bootstrap } = require('../src/main');
  const app = await bootstrap();
  const cong = process.env.PORT || 3001;

  const tokenAdmin = taoToken(DEV_ADMIN_ID, 'admin@t-hotel.local');
  const tokenKhach = taoToken(DEV_KHACH_ID, 'khach@t-hotel.local');

  log('');
  log('='.repeat(78));
  log(`  API        http://localhost:${cong}/api`);
  log(`  Health     http://localhost:${cong}/api/health`);
  log(`  Phong trong  http://localhost:${cong}/api/availability?checkIn=<YYYY-MM-DD>&checkOut=<YYYY-MM-DD>`);
  log('');
  log(`  hotelId    ${seed.hotelId}`);
  log(`  roomId     ${seed.roomIds[2]}   (phong doi 201)`);
  log(`  Mua cao diem  ${seed.muaCaoDiem.startDate} -> ${seed.muaCaoDiem.endDate}`);
  log('');
  log('  Token admin (12h):');
  log(`  ${tokenAdmin}`);
  log('');
  log('  Token khach (12h):');
  log(`  ${tokenKhach}`);
  log('');
  log('  Kiem thu nhanh o terminal khac:');
  log('    node scripts/smoke-test.js');
  log('');
  log('  Ctrl+C de dung ca API lan Postgres.');
  log('='.repeat(78));

  let dangDung = false;
  const dung = async () => {
    if (dangDung) {
      return;
    }
    dangDung = true;
    log('\nDang dung...');
    try {
      await app.close();
    } catch (error) {
      log(`Khong dong duoc API sach se: ${error.message}`);
    }
    if (postgres) {
      try {
        await postgres.stop();
      } catch (error) {
        log(`Khong tat duoc Postgres sach se: ${error.message}`);
      }
    }
    process.exit(0);
  };

  process.on('SIGINT', dung);
  process.on('SIGTERM', dung);
}

main().catch((error) => {
  console.error(`\ndev-up that bai: ${error.message}`);
  process.exit(1);
});

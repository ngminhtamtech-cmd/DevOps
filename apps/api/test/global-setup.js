/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Khoi dong mot Postgres THAT truoc khi chay test e2e.
 *
 * Vi sao khong dung mock hay pg-mem: rang buoc chong double-booking cua T_Hotel
 * la exclusion constraint GiST tren daterange — thu ma chi Postgres that moi co.
 * Test tren gia lap se xanh trong khi production van bi double-booking.
 *
 * Vi sao khong dung Docker: giai doan 3 moi cai Docker. `embedded-postgres` tai
 * san binary Postgres vao node_modules va chay nhu mot tien trinh thuong, khong
 * can quyen admin, chay duoc ca tren may Windows nay lan tren CI.
 */
const path = require('node:path');
const fs = require('node:fs');
const net = require('node:net');

const DATA_DIR = path.join(__dirname, '..', '.tmp-pg');
const PORT = Number(process.env.TEST_PG_PORT || 55433);
const CONNECTION_STRING = `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres`;

/**
 * Cong da co nguoi nghe chua? Neu mot postgres cu con sot lai tu lan chay truoc
 * (vd. bi Ctrl+C giua chung), `start()` cua embedded-postgres se cho mai ma
 * khong bao gi — test treo vo han thay vi that bai. Kiem tra truoc de doi cai
 * treo do thanh mot thong bao doc duoc trong mot giay.
 */
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

module.exports = async function globalSetup() {
  const imported = require('embedded-postgres');
  const EmbeddedPostgres = imported.default || imported;

  if (await congDangBiChiem(PORT)) {
    throw new Error(
      `Cong ${PORT} dang bi chiem — nhieu kha nang la mot postgres.exe con sot lai tu lan ` +
        'chay test truoc. Tat no di (Windows: Get-Process postgres | Stop-Process -Force) ' +
        `roi chay lai, hoac dat TEST_PG_PORT sang cong khac.`,
    );
  }

  // Cluster cu con sot lai tu lan chay truoc se lam initdb that bai.
  fs.rmSync(DATA_DIR, { recursive: true, force: true });

  const postgres = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: 'postgres',
    password: 'postgres',
    port: PORT,
    // `persistent: false` khien thu vien xoa thu muc du lieu NGAY sau khi tat
    // postgres. Tren Windows viec do hay ném EBUSY vi handle chua duoc tra, va
    // Jest bien loi don dep do thanh exit 1 du moi test da xanh. Giu du lieu lai
    // va don o dau lan chay sau (fs.rmSync ngay tren) thi khong con canh tranh.
    persistent: true,
    // Locale mac dinh cua may Windows tieng Viet la WIN1252, khong luu duoc
    // tieng Viet co dau. Ep UTF8 de test khop voi Supabase (cung UTF8).
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    onLog: () => undefined,
    onError: () => undefined,
  });

  await postgres.initialise();
  await postgres.start();

  // ts-node cho phep goi thang migration runner viet bang TypeScript,
  // dam bao test dung dung code migration ma production dung.
  require('ts-node').register({
    transpileOnly: true,
    compilerOptions: { module: 'commonjs' },
  });
  const { runMigrations } = require('../src/database/migration-runner');
  await runMigrations({ connectionString: CONNECTION_STRING });

  // Bien moi truong dat o day duoc ke thua boi cac worker cua Jest.
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = CONNECTION_STRING;
  process.env.DATABASE_SSL = 'false';
  process.env.SUPABASE_JWT_SECRET = 'test-jwt-secret-chi-dung-trong-test-0123456789';
  process.env.CORS_ORIGINS = 'http://localhost:3000';
  delete process.env.SUPABASE_JWT_ISSUER;

  globalThis.__EMBEDDED_POSTGRES__ = postgres;
};

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

const DATA_DIR = path.join(__dirname, '..', '.tmp-pg');
const PORT = Number(process.env.TEST_PG_PORT || 55433);
const CONNECTION_STRING = `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres`;

module.exports = async function globalSetup() {
  const imported = require('embedded-postgres');
  const EmbeddedPostgres = imported.default || imported;

  // Cluster cu con sot lai tu lan chay truoc se lam initdb that bai.
  fs.rmSync(DATA_DIR, { recursive: true, force: true });

  const postgres = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: 'postgres',
    password: 'postgres',
    port: PORT,
    persistent: false,
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

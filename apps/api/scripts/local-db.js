/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Postgres cuc bo cho moi truong dev, chay bang `npm run db:local`.
 *
 * Muc dich: chay duoc API tren may that ma khong can Docker (giai doan 3 moi cai)
 * va khong can mat khau database cua Supabase. Du lieu duoc giu lai giua cac lan
 * chay (persistent) trong thu muc .local-pg, khac voi database cua test von bi
 * xoa sach moi lan.
 *
 * Ket noi: postgresql://postgres:postgres@127.0.0.1:55432/postgres
 */
const path = require('node:path');
const fs = require('node:fs');

const DATA_DIR = path.join(__dirname, '..', '.local-pg');
const PORT = Number(process.env.LOCAL_PG_PORT || 55432);

async function main() {
  const imported = require('embedded-postgres');
  const EmbeddedPostgres = imported.default || imported;

  const isFirstRun = !fs.existsSync(DATA_DIR);

  const postgres = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: 'postgres',
    password: 'postgres',
    port: PORT,
    persistent: true,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
  });

  if (isFirstRun) {
    console.log('Lan dau chay: dang khoi tao cluster Postgres...');
    await postgres.initialise();
  }

  await postgres.start();
  console.log(`Postgres cuc bo dang chay tai cong ${PORT}.`);
  console.log(`DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres`);
  console.log('Nhan Ctrl+C de dung.');

  const shutdown = async () => {
    console.log('\nDang dung Postgres...');
    await postgres.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error(`Khong khoi dong duoc Postgres cuc bo: ${error.message}`);
  process.exit(1);
});

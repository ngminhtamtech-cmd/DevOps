import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

export interface RunMigrationsOptions {
  connectionString: string;
  ssl?: boolean;
  migrationsDir?: string;
  log?: (message: string) => void;
}

/** Thu muc chua file .sql. Sau khi build, nest-cli copy chung sang dist/database/migrations. */
export const DEFAULT_MIGRATIONS_DIR = join(__dirname, 'migrations');

/**
 * Migration runner toi gian: doc cac file .sql theo thu tu ten, chay file nao
 * chua co trong bang schema_migrations, moi file trong mot transaction rieng.
 *
 * Vi sao tu viet thay vi dung thu vien: chi can dung mot bang trang thai, chay
 * duoc tren ca Supabase lan Postgres cua test, va giai thich duoc trong phong van.
 */
export async function runMigrations(options: RunMigrationsOptions): Promise<MigrationResult> {
  const migrationsDir = options.migrationsDir ?? DEFAULT_MIGRATIONS_DIR;
  const log = options.log ?? (() => undefined);

  const client = new Client({
    connectionString: options.connectionString,
    ssl: options.ssl ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();

  const result: MigrationResult = { applied: [], skipped: [] };

  try {
    await client.query(`
      create table if not exists public.schema_migrations (
        filename    text primary key,
        checksum    text not null,
        applied_at  timestamptz not null default now()
      )
    `);

    const files = readdirSync(migrationsDir)
      .filter((name) => name.endsWith('.sql'))
      .sort();

    const { rows } = await client.query<{ filename: string; checksum: string }>(
      'select filename, checksum from public.schema_migrations',
    );
    const alreadyApplied = new Map(rows.map((row) => [row.filename, row.checksum]));

    for (const filename of files) {
      const sql = readFileSync(join(migrationsDir, filename), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const previousChecksum = alreadyApplied.get(filename);

      if (previousChecksum) {
        if (previousChecksum !== checksum) {
          throw new Error(
            `Migration ${filename} da chay nhung noi dung file da thay doi. ` +
              'Sua migration cu se lam database moi va cu lech nhau — hay tao file migration moi.',
          );
        }
        result.skipped.push(filename);
        continue;
      }

      log(`Dang chay migration ${filename}`);
      // pg dung simple query protocol khi khong truyen tham so, nho vay mot chuoi
      // nhieu lenh (ke ca than ham $$ ... $$) chay duoc trong mot lan goi.
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'insert into public.schema_migrations (filename, checksum) values ($1, $2)',
          [filename, checksum],
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
      result.applied.push(filename);
    }

    return result;
  } finally {
    await client.end();
  }
}

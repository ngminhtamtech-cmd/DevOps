import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, QueryResultRow } from 'pg';
import { AppEnv, ENV_NAMESPACE } from '../config/env';

/**
 * Boc pg.Pool. Toan bo truy van SQL trong API di qua day.
 *
 * Vi sao dung pg + SQL thuan thay vi ORM: nghiep vu loi cua T_Hotel la exclusion
 * constraint tren daterange va giao dich chong double-booking — nhung thu ORM che
 * di hoac khong ho tro. Xem docs/adr/0002-pg-thuan-thay-vi-orm.md.
 */
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly pool: Pool;

  constructor(configService: ConfigService) {
    const env = configService.getOrThrow<AppEnv>(ENV_NAMESPACE);

    this.pool = new Pool({
      connectionString: env.DATABASE_URL,
      max: env.DATABASE_POOL_MAX,
      // Supabase dung chung chi TLS do Let's Encrypt cap qua pooler; bat SSL
      // nhung khong ep xac minh chuoi chung chi de tranh loi SELF_SIGNED_CERT.
      ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
    });

    this.pool.on('error', (error) => {
      // Loi tren connection dang nam khong (idle) khong gan voi request nao.
      // Khong bat o day thi Node ném uncaughtException va giet process.
      this.logger.error(`Loi tren ket noi Postgres nhan roi: ${error.message}`);
    });
  }

  async query<T extends QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
    const result = await this.pool.query<T>(text, params);
    return result.rows;
  }

  async queryOne<T extends QueryResultRow>(
    text: string,
    params: unknown[] = [],
  ): Promise<T | null> {
    const rows = await this.query<T>(text, params);
    return rows[0] ?? null;
  }

  /**
   * Chay `handler` trong mot transaction. Tu dong COMMIT khi thanh cong,
   * ROLLBACK khi ném loi, va luon tra connection ve pool.
   */
  async transaction<T>(handler: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await handler(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async ping(): Promise<boolean> {
    const rows = await this.query<{ ok: number }>('select 1 as ok');
    return rows[0]?.ok === 1;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}

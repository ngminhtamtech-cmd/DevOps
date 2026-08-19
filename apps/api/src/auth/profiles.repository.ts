import { Injectable } from '@nestjs/common';
import type { UserRole } from '@t-hotel/shared-types';
import { DatabaseService } from '../database/database.service';

interface ProfileRow {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
}

@Injectable()
export class ProfilesRepository {
  constructor(private readonly database: DatabaseService) {}

  /**
   * Lay ho so, tu tao voi role 'customer' neu day la lan dau user goi API.
   *
   * Supabase quan ly bang auth.users, con phan quyen cua T_Hotel nam o
   * public.profiles. Tu tao o day thay vi dat trigger tren auth.users de schema
   * chay duoc tren ca Postgres thuan (test/CI khong co schema auth).
   */
  async findOrCreate(userId: string, email: string | null): Promise<ProfileRow> {
    const existing = await this.database.queryOne<ProfileRow>(
      'select id, email, full_name, role from public.profiles where id = $1',
      [userId],
    );
    if (existing) {
      return existing;
    }

    // ON CONFLICT DO UPDATE (khong phai DO NOTHING) de luon co RETURNING tra ve
    // hang du hai request dau tien cua cung user chay song song.
    const created = await this.database.queryOne<ProfileRow>(
      `insert into public.profiles (id, email)
       values ($1, $2)
       on conflict (id) do update set email = coalesce(public.profiles.email, excluded.email)
       returning id, email, full_name, role`,
      [userId, email],
    );

    return created as ProfileRow;
  }

  async setRole(userId: string, role: UserRole): Promise<void> {
    await this.database.query('update public.profiles set role = $2 where id = $1', [userId, role]);
  }
}

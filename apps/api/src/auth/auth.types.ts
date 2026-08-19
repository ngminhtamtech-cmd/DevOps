import type { UserRole } from '@t-hotel/shared-types';

/** Nguoi dung da xac thuc, duoc guard gan vao request. */
export interface AuthenticatedUser {
  id: string;
  email: string | null;
  role: UserRole;
}

/** Cac truong cua T_Hotel quan tam trong JWT do Supabase Auth phat hanh. */
export interface SupabaseJwtPayload {
  sub: string;
  email?: string;
  aud?: string | string[];
  iss?: string;
  exp?: number;
}

/** Ma loi SQLSTATE cua Postgres ma T_Hotel co xu ly rieng. */
export const PG_ERROR = {
  UNIQUE_VIOLATION: '23505',
  FOREIGN_KEY_VIOLATION: '23503',
  CHECK_VIOLATION: '23514',
  /** Vi pham exclusion constraint — chinh la tin hieu double-booking. */
  EXCLUSION_VIOLATION: '23P01',
} as const;

interface PostgresError {
  code: string;
  constraint?: string;
}

export function isPostgresError(error: unknown, code: string): error is PostgresError {
  return typeof error === 'object' && error !== null && (error as PostgresError).code === code;
}

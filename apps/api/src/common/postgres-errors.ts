/** Ma loi SQLSTATE cua Postgres ma T_Hotel co xu ly rieng. */
export const PG_ERROR = {
  UNIQUE_VIOLATION: '23505',
  FOREIGN_KEY_VIOLATION: '23503',
  /**
   * Xoa mot hang dang duoc tham chieu boi khoa ngoai khai bao `on delete restrict`.
   * KHAC 23503: `restrict` kiem tra ngay va ném ma rieng nay, con `no action`
   * kiem tra o cuoi cau lenh va ném 23503. Bat thieu mot trong hai la loi 500.
   */
  RESTRICT_VIOLATION: '23001',
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

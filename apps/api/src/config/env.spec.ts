import { loadAppEnv } from './env';

const validEnv = {
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/t_hotel',
  SUPABASE_JWT_SECRET: 'day-la-secret-du-dai-cho-hs256-0123456789',
};

describe('loadAppEnv', () => {
  it('dien gia tri mac dinh cho cac bien khong bat buoc', () => {
    const env = loadAppEnv(validEnv);

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3001);
    expect(env.DATABASE_SSL).toBe(false);
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:3000']);
  });

  it('doi PORT tu chuoi sang so', () => {
    expect(loadAppEnv({ ...validEnv, PORT: '8080' }).PORT).toBe(8080);
  });

  it('doi CORS_ORIGINS thanh mang va bo khoang trang thua', () => {
    const env = loadAppEnv({
      ...validEnv,
      CORS_ORIGINS: 'https://a.com, https://b.com ,',
    });
    expect(env.CORS_ORIGINS).toEqual(['https://a.com', 'https://b.com']);
  });

  it('ném loi khi thieu DATABASE_URL', () => {
    expect(() => loadAppEnv({ SUPABASE_JWT_SECRET: validEnv.SUPABASE_JWT_SECRET })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('ném loi khi JWT secret qua ngan', () => {
    expect(() => loadAppEnv({ ...validEnv, SUPABASE_JWT_SECRET: 'qua-ngan' })).toThrow(
      /SUPABASE_JWT_SECRET/,
    );
  });

  it('ném loi khi NODE_ENV khong nam trong danh sach cho phep', () => {
    expect(() => loadAppEnv({ ...validEnv, NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
  });
});

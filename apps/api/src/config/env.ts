import { z } from 'zod';

/**
 * Xac thuc bien moi truong ngay khi khoi dong.
 * Thieu hoac sai dinh dang thi process chet ngay voi thong bao ro rang,
 * thay vi chet giua chung khi co request dau tien (R8: xu ly loi tai bien he thong).
 */
const booleanFromString = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');

export const appEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL la bat buoc'),
  DATABASE_SSL: booleanFromString.default('false'),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),

  // Bi mat dung de xac minh chu ky JWT do Supabase Auth phat hanh.
  // Toi thieu 32 ky tu theo yeu cau cua HS256.
  SUPABASE_JWT_SECRET: z.string().min(32, 'SUPABASE_JWT_SECRET phai dai it nhat 32 ky tu'),
  SUPABASE_JWT_ISSUER: z.string().optional(),

  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
});

export type AppEnv = z.infer<typeof appEnvSchema>;

/** Khoa dung de doc config da xac thuc: `configService.getOrThrow<AppEnv>(ENV_NAMESPACE)`. */
export const ENV_NAMESPACE = 'env';

export function loadAppEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const result = appEnvSchema.safeParse(source);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Cau hinh moi truong khong hop le:\n${details}`);
  }

  return result.data;
}

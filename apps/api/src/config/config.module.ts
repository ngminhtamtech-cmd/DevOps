import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { ENV_NAMESPACE, loadAppEnv } from './env';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      // Uu tien .env cua rieng apps/api, sau do den .env o goc monorepo.
      envFilePath: ['.env', '../../.env'],
      cache: true,
      load: [() => ({ [ENV_NAMESPACE]: loadAppEnv() })],
    }),
  ],
})
export class AppConfigModule {}

import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { AppEnv, ENV_NAMESPACE } from './config/env';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const env = app.get(ConfigService).getOrThrow<AppEnv>(ENV_NAMESPACE);

  configureApp(app, env.CORS_ORIGINS);
  app.enableShutdownHooks();

  await app.listen(env.PORT, '0.0.0.0');
  new Logger('Bootstrap').log(`T_Hotel API dang chay tai http://localhost:${env.PORT}/api`);
}

void bootstrap();

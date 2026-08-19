import 'reflect-metadata';
import { INestApplication, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { AppEnv, ENV_NAMESPACE } from './config/env';

export async function bootstrap(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule);
  const env = app.get(ConfigService).getOrThrow<AppEnv>(ENV_NAMESPACE);

  configureApp(app, env.CORS_ORIGINS);
  app.enableShutdownHooks();

  await app.listen(env.PORT, '0.0.0.0');
  new Logger('Bootstrap').log(`T_Hotel API dang chay tai http://localhost:${env.PORT}/api`);
  return app;
}

// Chi tu chay khi duoc goi truc tiep (`node dist/main.js`). Khi file nay duoc
// import — scripts/dev-up.js lam vay de tu dong dong app luc Ctrl+C — thi khong
// tu khoi dong, de ben goi quyet dinh vong doi.
if (require.main === module) {
  void bootstrap();
}

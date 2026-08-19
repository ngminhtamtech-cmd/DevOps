import { INestApplication, ValidationPipe } from '@nestjs/common';

/**
 * Cau hinh dung chung cho app that (main.ts) va app trong test e2e.
 * De o mot cho de test chay dung tren cung mot cau hinh voi production —
 * neu tach doi, test co the xanh trong khi that te 400 vi validation khac nhau.
 */
export function configureApp(app: INestApplication, corsOrigins: string[]): void {
  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      // Loai bo truong khong khai bao trong DTO.
      whitelist: true,
      // Tu choi thang neu client gui truong la, thay vi am tham bo di.
      forbidNonWhitelisted: true,
      // Bat @Type(() => Number) hoat dong cho query string (von luon la chuoi).
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  app.enableCors({ origin: corsOrigins, credentials: true });
}

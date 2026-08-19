import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { RolesGuard } from './auth/roles.guard';
import { SupabaseJwtGuard } from './auth/supabase-jwt.guard';
import { AppConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { AvailabilityModule } from './modules/availability/availability.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { HealthModule } from './modules/health/health.module';
import { HotelsModule } from './modules/hotels/hotels.module';
import { RoomTypesModule } from './modules/room-types/room-types.module';
import { RoomsModule } from './modules/rooms/rooms.module';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    AuthModule,
    HealthModule,
    HotelsModule,
    RoomTypesModule,
    RoomsModule,
    AvailabilityModule,
    BookingsModule,
  ],
  providers: [
    // Mac dinh MOI endpoint deu yeu cau dang nhap; muon mo cong khai phai danh
    // dau @Public(). Chon huong "dong mac dinh" de quen decorator thi endpoint
    // bi khoa, chu khong bi ho.
    { provide: APP_GUARD, useClass: SupabaseJwtGuard },
    // Thu tu trong mang nay chinh la thu tu chay: RolesGuard doc request.user do
    // SupabaseJwtGuard gan, nen bat buoc phai dung sau.
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}

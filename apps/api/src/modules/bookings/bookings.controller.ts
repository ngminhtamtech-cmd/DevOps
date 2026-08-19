import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import type { Booking } from '@t-hotel/shared-types';
import type { AuthenticatedUser } from '../../auth/auth.types';
import { CurrentUser } from '../../auth/decorators';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto';

/** Moi endpoint o day deu yeu cau dang nhap (khong co @Public). */
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Post()
  create(
    @Body() dto: CreateBookingDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Booking> {
    return this.bookings.create(dto, user);
  }

  @Get('me')
  findMine(@CurrentUser() user: AuthenticatedUser): Promise<Booking[]> {
    return this.bookings.findMine(user.id);
  }

  @Get(':id')
  findById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Booking> {
    return this.bookings.findByIdForUser(id, user);
  }

  @Post(':id/cancel')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Booking> {
    return this.bookings.cancel(id, user);
  }
}

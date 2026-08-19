import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import type { Hotel } from '@t-hotel/shared-types';
import { Public, Roles } from '../../auth/decorators';
import { CreateHotelDto } from './dto';
import { HotelsService } from './hotels.service';

@Controller('hotels')
export class HotelsController {
  constructor(private readonly hotels: HotelsService) {}

  @Public()
  @Get()
  findAll(): Promise<Hotel[]> {
    return this.hotels.findAll();
  }

  @Public()
  @Get(':id')
  findById(@Param('id', ParseUUIDPipe) id: string): Promise<Hotel> {
    return this.hotels.findById(id);
  }

  @Roles('admin')
  @Post()
  create(@Body() dto: CreateHotelDto): Promise<Hotel> {
    return this.hotels.create(dto);
  }
}

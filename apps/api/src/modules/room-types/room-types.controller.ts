import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import type { RoomType } from '@t-hotel/shared-types';
import { Public, Roles } from '../../auth/decorators';
import { CreateRatePlanDto, CreateRoomTypeDto } from './dto';
import { RatePlan, RoomTypesService } from './room-types.service';

@Controller('room-types')
export class RoomTypesController {
  constructor(private readonly roomTypes: RoomTypesService) {}

  @Public()
  @Get()
  findByHotel(@Query('hotelId', ParseUUIDPipe) hotelId: string): Promise<RoomType[]> {
    return this.roomTypes.findByHotel(hotelId);
  }

  @Public()
  @Get(':id')
  findById(@Param('id', ParseUUIDPipe) id: string): Promise<RoomType> {
    return this.roomTypes.findById(id);
  }

  @Roles('admin')
  @Post()
  create(@Body() dto: CreateRoomTypeDto): Promise<RoomType> {
    return this.roomTypes.create(dto);
  }

  @Public()
  @Get(':id/rate-plans')
  listRatePlans(@Param('id', ParseUUIDPipe) id: string): Promise<RatePlan[]> {
    return this.roomTypes.listRatePlans(id);
  }

  @Roles('admin')
  @Post(':id/rate-plans')
  createRatePlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateRatePlanDto,
  ): Promise<RatePlan> {
    return this.roomTypes.createRatePlan(id, dto);
  }
}

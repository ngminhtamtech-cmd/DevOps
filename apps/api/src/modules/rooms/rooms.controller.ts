import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { Room } from '@t-hotel/shared-types';
import { Public, Roles } from '../../auth/decorators';
import { CreateRoomDto, ListRoomsQueryDto, UpdateRoomDto } from './dto';
import { RoomsService } from './rooms.service';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Public()
  @Get()
  findAll(@Query() query: ListRoomsQueryDto): Promise<Room[]> {
    return this.rooms.findAll(query);
  }

  @Public()
  @Get(':id')
  findById(@Param('id', ParseUUIDPipe) id: string): Promise<Room> {
    return this.rooms.findById(id);
  }

  @Roles('admin')
  @Post()
  create(@Body() dto: CreateRoomDto): Promise<Room> {
    return this.rooms.create(dto);
  }

  @Roles('admin')
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRoomDto): Promise<Room> {
    return this.rooms.update(id, dto);
  }

  @Roles('admin')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.rooms.remove(id);
  }
}

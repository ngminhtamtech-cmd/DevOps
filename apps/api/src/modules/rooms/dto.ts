import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { ROOM_STATUSES, RoomStatus } from '@t-hotel/shared-types';

export class CreateRoomDto {
  @IsUUID()
  hotelId: string;

  @IsUUID()
  roomTypeId: string;

  @IsString()
  @Matches(/^[A-Za-z0-9-]{1,10}$/, {
    message: 'roomNumber chi gom chu, so, dau gach ngang, toi da 10 ky tu',
  })
  roomNumber: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(200)
  floor?: number;

  @IsOptional()
  @IsIn(ROOM_STATUSES as unknown as string[])
  status?: RoomStatus;
}

export class UpdateRoomDto {
  @IsOptional()
  @IsUUID()
  roomTypeId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9-]{1,10}$/)
  roomNumber?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(200)
  floor?: number;

  @IsOptional()
  @IsIn(ROOM_STATUSES as unknown as string[])
  status?: RoomStatus;
}

export class ListRoomsQueryDto {
  @IsOptional()
  @IsUUID()
  hotelId?: string;

  @IsOptional()
  @IsUUID()
  roomTypeId?: string;

  @IsOptional()
  @IsIn(ROOM_STATUSES as unknown as string[])
  status?: RoomStatus;
}


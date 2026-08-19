import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ROOM_TYPE_CODES } from '@t-hotel/shared-types';
import { IsIsoDate } from '../../common/iso-date';

export class CreateRoomTypeDto {
  @IsUUID()
  hotelId: string;

  @IsIn(ROOM_TYPE_CODES as unknown as string[])
  code: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  capacity: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  basePriceCents: number;
}

export class CreateRatePlanDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsIsoDate()
  startDate: string;

  /** Ngay ket thuc KHONG bao gom, dong bo voi daterange '[)' trong database. */
  @IsIsoDate()
  endDate: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceCents: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  priority?: number;
}

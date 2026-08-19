import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { IsIsoDate } from '../../common/iso-date';

export class SearchAvailabilityQueryDto {
  @IsIsoDate()
  checkIn: string;

  /** Ngay tra phong, khong tinh la dem luu tru. */
  @IsIsoDate()
  checkOut: string;

  @IsOptional()
  @IsUUID()
  hotelId?: string;

  @IsOptional()
  @IsUUID()
  roomTypeId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  guests?: number;
}

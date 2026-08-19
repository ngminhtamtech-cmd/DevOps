import { IsEmail, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { IsIsoDate } from '../../common/iso-date';

export class CreateBookingDto {
  @IsUUID()
  roomId: string;

  @IsIsoDate()
  checkIn: string;

  /** Ngay tra phong. Khong tinh la dem, va co the trung ngay nhan phong cua khach khac. */
  @IsIsoDate()
  checkOut: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  guestName: string;

  @IsEmail()
  @MaxLength(160)
  guestEmail: string;
}

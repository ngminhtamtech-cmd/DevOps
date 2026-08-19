import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateHotelDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  address: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  city: string;
}

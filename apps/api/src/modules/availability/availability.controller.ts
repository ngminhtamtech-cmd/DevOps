import { Controller, Get, Query } from '@nestjs/common';
import type { AvailableRoom } from '@t-hotel/shared-types';
import { Public } from '../../auth/decorators';
import { AvailabilityService } from './availability.service';
import { SearchAvailabilityQueryDto } from './dto';

@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  /** GET /availability?checkIn=2026-09-01&checkOut=2026-09-04&guests=2 */
  @Public()
  @Get()
  search(@Query() query: SearchAvailabilityQueryDto): Promise<AvailableRoom[]> {
    return this.availability.search(query);
  }
}

import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../../auth/decorators';
import { DatabaseService } from '../../database/database.service';

/**
 * Endpoint suc khoe. Giai doan 3 (docker healthcheck) va giai doan 6 (monitoring)
 * se dua vao chinh endpoint nay, nen no kiem tra ca ket noi database chu khong
 * chi tra ve "ok".
 */
@Controller('health')
export class HealthController {
  constructor(private readonly database: DatabaseService) {}

  @Public()
  @Get()
  async check(): Promise<{ status: string; database: string; uptimeSeconds: number }> {
    let databaseStatus: string;
    try {
      databaseStatus = (await this.database.ping()) ? 'up' : 'down';
    } catch {
      databaseStatus = 'down';
    }

    if (databaseStatus !== 'up') {
      throw new ServiceUnavailableException({ status: 'error', database: databaseStatus });
    }

    return {
      status: 'ok',
      database: databaseStatus,
      uptimeSeconds: Math.round(process.uptime()),
    };
  }
}

import {
  Controller,
  Get,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../@decorators/public.decorator.js';
import { DatabaseService } from '../prisma/database.service.js';

@ApiTags('Health')
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);
  constructor(private readonly database: DatabaseService) {}
  @Get('live')
  @ApiOperation({ summary: 'Process liveness' })
  live() {
    return { status: 'ok' };
  }
  @Get('ready')
  @ApiOperation({ summary: 'Database and application schema readiness' })
  @ApiResponse({
    status: 503,
    description: 'Database unavailable or schema missing',
  })
  async ready() {
    try {
      await this.database.ping();
      return { status: 'ok', database: 'connected' };
    } catch {
      this.logger.error('Database readiness check failed');
      throw new ServiceUnavailableException('Service not ready');
    }
  }
}

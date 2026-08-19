import { DatabaseService } from '@afds-nest-starter/platform';
import { Injectable } from '@nestjs/common';
import { HealthIndicatorService, type HealthIndicatorResult } from '@nestjs/terminus';

@Injectable()
export class DatabaseHealthIndicator {
  constructor(
    private readonly healthIndicator: HealthIndicatorService,
    private readonly database: DatabaseService,
  ) {}

  async check(): Promise<HealthIndicatorResult<'database'>> {
    const indicator = this.healthIndicator.check('database');
    try {
      await this.database.pool.query('select 1');
      return indicator.up();
    } catch {
      return indicator.down('database check failed');
    }
  }
}

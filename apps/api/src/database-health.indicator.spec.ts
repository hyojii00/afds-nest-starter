import type { DatabaseService } from '@afds-nest-starter/platform';
import { HealthIndicatorService } from '@nestjs/terminus';
import { describe, expect, it, vi } from 'vitest';
import { DatabaseHealthIndicator } from './database-health.indicator';

describe('DatabaseHealthIndicator', () => {
  it('reports the database as up after a successful query', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] });
    const indicator = new DatabaseHealthIndicator(new HealthIndicatorService(), {
      pool: { query },
    } as unknown as DatabaseService);

    await expect(indicator.check()).resolves.toEqual({ database: { status: 'up' } });
  });

  it('reports the database as down without leaking an exception', async () => {
    const query = vi.fn().mockRejectedValue(new Error('connection refused'));
    const indicator = new DatabaseHealthIndicator(new HealthIndicatorService(), {
      pool: { query },
    } as unknown as DatabaseService);

    await expect(indicator.check()).resolves.toEqual({
      database: { status: 'down', message: 'database check failed' },
    });
  });
});

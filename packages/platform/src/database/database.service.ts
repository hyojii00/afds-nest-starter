import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

@Injectable()
export class DatabaseService {
  readonly pool: Pool;
  readonly db: NodePgDatabase;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is required');
    }

    this.pool = new Pool({ connectionString });
    this.db = drizzle(this.pool);
  }

  async assertReady(): Promise<void> {
    try {
      await this.pool.query('select 1');
    } catch {
      throw new ServiceUnavailableException('database is not ready');
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

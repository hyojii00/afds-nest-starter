import { DatabaseService, type IntegrationEventEnvelope } from '@afds-nest-starter/platform';
import { Injectable } from '@nestjs/common';
import { toOrderActivity } from './order-created-event';
import { orderActivity } from './schema';

@Injectable()
export class OrderActivityProjector {
  constructor(private readonly database: DatabaseService) {}

  async project(event: IntegrationEventEnvelope): Promise<void> {
    const activity = toOrderActivity(event);
    if (!activity) {
      return;
    }

    await this.database.db.insert(orderActivity).values(activity).onConflictDoNothing();
  }
}

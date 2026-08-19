import { Injectable, Logger } from '@nestjs/common';
import type { EventPublisher, IntegrationEventEnvelope } from './event-publisher';

@Injectable()
export class ConsoleEventPublisher implements EventPublisher {
  private readonly logger = new Logger(ConsoleEventPublisher.name);

  async publish(event: IntegrationEventEnvelope): Promise<void> {
    this.logger.log(JSON.stringify({ message: 'integration_event_published', event }));
  }
}

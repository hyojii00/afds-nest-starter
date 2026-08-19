import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ConsoleEventPublisher } from './console-event.publisher';
import { EVENT_PUBLISHER } from './event-publisher';
import { OutboxRelayService } from './outbox-relay.service';
import { OutboxRunnerService } from './outbox-runner.service';

@Module({
  imports: [DatabaseModule],
  providers: [
    ConsoleEventPublisher,
    { provide: EVENT_PUBLISHER, useExisting: ConsoleEventPublisher },
    OutboxRelayService,
    OutboxRunnerService,
  ],
})
export class OutboxModule {}

import { type DynamicModule, Module, type Type } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { EVENT_PUBLISHER, type EventPublisher } from './event-publisher';
import { OutboxRelayService } from './outbox-relay.service';
import { OutboxRunnerService } from './outbox-runner.service';

@Module({})
// biome-ignore lint/complexity/noStaticOnlyClass: Nest dynamic modules use a static registration factory.
export class OutboxModule {
  static register(publisher: Type<EventPublisher>): DynamicModule {
    return {
      module: OutboxModule,
      imports: [DatabaseModule],
      providers: [
        publisher,
        { provide: EVENT_PUBLISHER, useExisting: publisher },
        OutboxRelayService,
        OutboxRunnerService,
      ],
    };
  }
}

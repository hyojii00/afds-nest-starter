import { OutboxModule, validateEnvironment } from '@afds-nest-starter/platform';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KafkaEventPublisher } from './kafka-event.publisher';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    OutboxModule.register(KafkaEventPublisher),
  ],
})
export class WorkerModule {}

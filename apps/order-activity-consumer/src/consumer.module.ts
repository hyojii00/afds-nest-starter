import { DatabaseModule, validateEnvironment } from '@afds-nest-starter/platform';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OrderActivityConsumer } from './order-activity.consumer';
import { OrderActivityProjector } from './order-activity.projector';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    DatabaseModule,
  ],
  providers: [OrderActivityProjector, OrderActivityConsumer],
})
export class ConsumerModule {}

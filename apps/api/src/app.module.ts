import { OrderingModule } from '@afds-nest-starter/ordering';
import { DatabaseModule, validateEnvironment } from '@afds-nest-starter/platform';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    DatabaseModule,
    OrderingModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

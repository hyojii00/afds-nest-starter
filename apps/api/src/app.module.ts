import { OrderingModule } from '@afds-nest-starter/ordering';
import { DatabaseModule, validateEnvironment } from '@afds-nest-starter/platform';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { DatabaseHealthIndicator } from './database-health.indicator';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    TerminusModule,
    DatabaseModule,
    OrderingModule,
  ],
  controllers: [HealthController],
  providers: [DatabaseHealthIndicator],
})
export class AppModule {}

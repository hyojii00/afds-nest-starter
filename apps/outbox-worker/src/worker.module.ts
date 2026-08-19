import { OutboxModule, validateEnvironment } from '@afds-nest-starter/platform';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }), OutboxModule],
})
export class WorkerModule {}

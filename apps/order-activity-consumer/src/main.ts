import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConsumerModule } from './consumer.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(ConsumerModule);
  app.enableShutdownHooks();
  new Logger('Bootstrap').log('Order activity consumer is running');
}

void bootstrap();

import {
  readKafkaSettings,
  type EventPublisher,
  type IntegrationEventEnvelope,
} from '@afds-nest-starter/platform';
import { KafkaJS } from '@confluentinc/kafka-javascript';
import { Injectable, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';

@Injectable()
export class KafkaEventPublisher implements EventPublisher, OnModuleInit, OnApplicationShutdown {
  private readonly producer: KafkaJS.Producer;
  private readonly topic: string;

  constructor() {
    const settings = readKafkaSettings();
    this.topic = settings.topic;
    this.producer = new KafkaJS.Kafka({
      kafkaJS: {
        clientId: 'outbox-worker',
        brokers: [...settings.brokers],
        logLevel: KafkaJS.logLevel.ERROR,
      },
    }).producer({
      kafkaJS: {
        acks: -1,
        allowAutoTopicCreation: true,
        idempotent: true,
        maxInFlightRequests: 5,
      },
    });
  }

  async onModuleInit(): Promise<void> {
    await this.producer.connect();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.producer.disconnect();
  }

  async publish(event: IntegrationEventEnvelope): Promise<void> {
    await this.producer.send({
      topic: this.topic,
      messages: [
        {
          key: event.aggregateId,
          value: JSON.stringify(event),
          headers: { eventId: event.eventId, eventType: event.eventType },
        },
      ],
    });
  }
}

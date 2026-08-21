import {
  decodeIntegrationEvent,
  readKafkaConsumerGroupId,
  readKafkaSettings,
} from '@afds-nest-starter/platform';
import { KafkaJS } from '@confluentinc/kafka-javascript';
import {
  Injectable,
  Logger,
  type BeforeApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import { OrderActivityProjector } from './order-activity.projector';

@Injectable()
export class OrderActivityConsumer implements OnModuleInit, BeforeApplicationShutdown {
  private readonly logger = new Logger(OrderActivityConsumer.name);
  private readonly admin: KafkaJS.Admin;
  private readonly consumer: KafkaJS.Consumer;
  private readonly topic: string;

  constructor(private readonly projector: OrderActivityProjector) {
    const settings = readKafkaSettings();
    this.topic = settings.topic;
    const kafka = new KafkaJS.Kafka({
      kafkaJS: {
        clientId: 'order-activity-consumer',
        brokers: [...settings.brokers],
        logLevel: KafkaJS.logLevel.ERROR,
      },
    });
    this.admin = kafka.admin();
    this.consumer = kafka.consumer({
      kafkaJS: {
        autoCommit: false,
        fromBeginning: true,
        groupId: readKafkaConsumerGroupId(),
      },
    });
  }

  async onModuleInit(): Promise<void> {
    await this.admin.connect();
    try {
      await this.admin.createTopics({ topics: [{ topic: this.topic }] });
    } finally {
      await this.admin.disconnect();
    }

    await this.consumer.connect();
    await this.consumer.subscribe({ topic: this.topic });
    await this.consumer.run({
      eachMessage: (payload) => this.processMessage(payload),
    });
    this.logger.log(`Order activity consumer subscribed to ${this.topic}`);
  }

  async beforeApplicationShutdown(): Promise<void> {
    await this.consumer.disconnect();
  }

  private async processMessage({
    topic,
    partition,
    message,
  }: KafkaJS.EachMessagePayload): Promise<void> {
    try {
      await this.projector.project(decodeIntegrationEvent(message.value));
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          message: 'integration_event_processing_failed',
          topic,
          partition,
          offset: message.offset,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      throw error;
    }

    await this.consumer.commitOffsets([
      {
        topic,
        partition,
        offset: (BigInt(message.offset) + 1n).toString(),
      },
    ]);
  }
}

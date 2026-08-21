import { randomUUID } from 'node:crypto';
import type { StartedKafkaContainer } from '@testcontainers/kafka';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { KafkaJS } from '@confluentinc/kafka-javascript';
import {
  DatabaseService,
  type IntegrationEventEnvelope,
  OutboxRelayService,
  outboxEvents,
} from '@afds-nest-starter/platform';
import { DrizzleOrderRepository, Order } from '@afds-nest-starter/ordering';
import { Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { OrderActivityConsumer } from '../../apps/order-activity-consumer/src/order-activity.consumer';
import { OrderActivityProjector } from '../../apps/order-activity-consumer/src/order-activity.projector';
import { orderActivity } from '../../apps/order-activity-consumer/src/schema';
import { KafkaEventPublisher } from '../../apps/outbox-worker/src/kafka-event.publisher';
import { getKafkaBroker, startKafka } from '../support/kafka';
import { migrateDatabase, startPostgres } from '../support/postgres';

describe('Kafka Outbox to order activity projection', () => {
  let kafkaContainer: StartedKafkaContainer;
  let postgresContainer: StartedPostgreSqlContainer;
  let database: DatabaseService;
  let publisher: KafkaEventPublisher;
  let consumer: OrderActivityConsumer;
  let broker: string;
  const topic = `ordering.events.${randomUUID()}`;
  const groupId = `order-activity.${randomUUID()}`;

  beforeAll(async () => {
    [postgresContainer, kafkaContainer] = await Promise.all([startPostgres(), startKafka()]);
    broker = getKafkaBroker(kafkaContainer);
    process.env.DATABASE_URL = postgresContainer.getConnectionUri();
    process.env.KAFKA_BROKERS = broker;
    process.env.KAFKA_TOPIC = topic;
    process.env.KAFKA_CONSUMER_GROUP_ID = groupId;
    await migrateDatabase(process.env.DATABASE_URL);
    database = new DatabaseService();
    publisher = new KafkaEventPublisher();
    await publisher.onModuleInit();
    consumer = new OrderActivityConsumer(new OrderActivityProjector(database));
    await consumer.onModuleInit();
  });

  afterAll(async () => {
    await consumer?.beforeApplicationShutdown();
    await publisher?.onApplicationShutdown();
    await database?.close();
    await Promise.all([kafkaContainer?.stop(), postgresContainer?.stop()]);
  });

  it('publishes, projects, commits, and deduplicates an order-created event', async () => {
    const order = Order.create({
      id: randomUUID(),
      customerId: 'customer-1',
      currency: 'KRW',
      items: [{ sku: 'book', quantity: 2, unitPriceMinor: 2_500 }],
    });
    await new DrizzleOrderRepository(database).save(order);

    const relay = new OutboxRelayService(database, publisher);
    await expect(
      relay.runOnce({ batchSize: 10, maxAttempts: 3, lockTimeoutMs: 60_000 }),
    ).resolves.toBe(1);

    const [storedEvent] = await database.db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.aggregateId, order.snapshot.id));
    expect(storedEvent).toMatchObject({ status: 'PUBLISHED', attempts: 1 });
    if (!storedEvent) {
      throw new Error('published Outbox event was not found');
    }

    await waitForCommittedOffset(1);

    const event: IntegrationEventEnvelope = {
      eventId: storedEvent.id,
      eventType: storedEvent.eventType,
      aggregateType: storedEvent.aggregateType,
      aggregateId: storedEvent.aggregateId,
      aggregateVersion: storedEvent.aggregateVersion,
      occurredAt: storedEvent.occurredAt.toISOString(),
      payload: storedEvent.payload,
    };
    await publisher.publish(event);
    await waitForCommittedOffset(2);

    const activities = await database.db
      .select()
      .from(orderActivity)
      .where(eq(orderActivity.eventId, event.eventId));
    expect(activities).toMatchObject([
      {
        orderId: order.snapshot.id,
        customerId: 'customer-1',
        currency: 'KRW',
        totalAmountMinor: 5_000,
      },
    ]);
  });

  it('logs a poison event and leaves its offset uncommitted', async () => {
    const committedBefore = await readCommittedOffset();
    const logError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const poisonEvent: IntegrationEventEnvelope = {
      eventId: randomUUID(),
      eventType: 'ordering.order.created.v1',
      aggregateType: 'order',
      aggregateId: randomUUID(),
      aggregateVersion: 1,
      occurredAt: new Date().toISOString(),
      payload: { customerId: '' },
    };

    try {
      await publisher.publish(poisonEvent);
      const matchingLogs = () =>
        logError.mock.calls.filter(([entry]) => {
          if (typeof entry !== 'string') {
            return false;
          }
          try {
            const logged = JSON.parse(entry) as Record<string, unknown>;
            return (
              logged.message === 'integration_event_processing_failed' &&
              logged.topic === topic &&
              logged.partition === 0 &&
              logged.offset === String(committedBefore)
            );
          } catch {
            return false;
          }
        });
      await waitFor(async () => matchingLogs().length > 0);
      await new Promise((resolve) => setTimeout(resolve, 1_200));
      expect(matchingLogs()).toHaveLength(1);
      expect(await readCommittedOffset()).toBe(committedBefore);
    } finally {
      logError.mockRestore();
    }
  });

  async function waitForCommittedOffset(expected: number): Promise<void> {
    const admin = new KafkaJS.Kafka({
      kafkaJS: { brokers: [broker], logLevel: KafkaJS.logLevel.ERROR },
    }).admin();
    await admin.connect();
    try {
      await waitFor(async () => {
        const offsets = await admin.fetchOffsets({ groupId, topics: [topic] });
        return Number(offsets[0]?.partitions[0]?.offset ?? 0) >= expected;
      });
    } finally {
      await admin.disconnect();
    }
  }

  async function readCommittedOffset(): Promise<number> {
    const admin = new KafkaJS.Kafka({
      kafkaJS: { brokers: [broker], logLevel: KafkaJS.logLevel.ERROR },
    }).admin();
    await admin.connect();
    try {
      const offsets = await admin.fetchOffsets({ groupId, topics: [topic] });
      return Number(offsets[0]?.partitions[0]?.offset ?? 0);
    } finally {
      await admin.disconnect();
    }
  }
});

async function waitFor(predicate: () => Promise<boolean>): Promise<void> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (await predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('condition was not met before timeout');
}

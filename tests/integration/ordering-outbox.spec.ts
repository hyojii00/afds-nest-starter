import { randomUUID } from 'node:crypto';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import {
  DatabaseService,
  type EventPublisher,
  OutboxRelayService,
  outboxEvents,
} from '@afds-nest-starter/platform';
import {
  DrizzleOrderRepository,
  OptimisticLockError,
  Order,
  orders,
} from '@afds-nest-starter/ordering';
import { eq } from 'drizzle-orm';
import { afterAll, assert, beforeAll, describe, expect, it, vi } from 'vitest';
import { migrateDatabase, startPostgres } from '../support/postgres';

describe('ordering persistence and transactional outbox', () => {
  let container: StartedPostgreSqlContainer;
  let database: DatabaseService;
  let repository: DrizzleOrderRepository;

  beforeAll(async () => {
    container = await startPostgres();
    process.env.DATABASE_URL = container.getConnectionUri();
    await migrateDatabase(process.env.DATABASE_URL);
    database = new DatabaseService();
    repository = new DrizzleOrderRepository(database);
  });

  afterAll(async () => {
    await database.close();
    await container.stop();
  });

  it('stores an order and its event in one transaction', async () => {
    const order = makeOrder();
    await repository.save(order);

    const storedOrder = await repository.findById(order.snapshot.id);
    const events = await database.db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.aggregateId, order.snapshot.id));

    expect(storedOrder?.snapshot).toMatchObject({ status: 'PENDING', totalAmountMinor: 5_000 });
    expect(events).toMatchObject([
      { eventType: 'ordering.order.created.v1', aggregateVersion: 1, status: 'PENDING' },
    ]);
    expect(order.domainEvents).toHaveLength(0);
  });

  it('rolls back the order if its outbox insert fails', async () => {
    await database.pool.query(
      "alter table outbox_events add constraint reject_created_event check (event_type <> 'ordering.order.created.v1') not valid",
    );
    const order = makeOrder();

    await expect(repository.save(order)).rejects.toThrow();
    const stored = await database.db.select().from(orders).where(eq(orders.id, order.snapshot.id));
    expect(stored).toHaveLength(0);
    expect(order.domainEvents).toHaveLength(1);

    await database.pool.query('alter table outbox_events drop constraint reject_created_event');
  });

  it('detects concurrent aggregate updates', async () => {
    const order = makeOrder();
    await repository.save(order);
    const first = await repository.findById(order.snapshot.id);
    const second = await repository.findById(order.snapshot.id);
    assert(first);
    assert(second);

    first.confirm();
    second.cancel('changed my mind');
    await repository.save(first);
    await expect(repository.save(second)).rejects.toThrow(OptimisticLockError);
  });

  it('publishes and marks a pending event', async () => {
    const order = makeOrder();
    await repository.save(order);
    const publish = vi.fn<EventPublisher['publish']>().mockResolvedValue(undefined);
    const relay = new OutboxRelayService(database, { publish });

    expect(
      await relay.runOnce({ batchSize: 10, maxAttempts: 3, lockTimeoutMs: 60_000 }),
    ).toBeGreaterThan(0);
    expect(publish).toHaveBeenCalled();
    const [event] = await database.db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.aggregateId, order.snapshot.id));
    expect(event).toMatchObject({ status: 'PUBLISHED', attempts: 1 });
  });

  it('marks an event failed after its final publish attempt', async () => {
    const order = makeOrder();
    await repository.save(order);
    const relay = new OutboxRelayService(database, {
      publish: vi.fn().mockRejectedValue(new Error('broker unavailable')),
    });

    await relay.runOnce({ batchSize: 10, maxAttempts: 1, lockTimeoutMs: 60_000 });
    const [event] = await database.db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.aggregateId, order.snapshot.id));
    expect(event).toMatchObject({ status: 'FAILED', attempts: 1, lastError: 'broker unavailable' });
  });

  it('does not let concurrent relays claim the same event', async () => {
    const order = makeOrder();
    await repository.save(order);
    const firstPublish = vi.fn<EventPublisher['publish']>().mockResolvedValue(undefined);
    const secondPublish = vi.fn<EventPublisher['publish']>().mockResolvedValue(undefined);
    const options = { batchSize: 10, maxAttempts: 3, lockTimeoutMs: 60_000 };

    const processed = await Promise.all([
      new OutboxRelayService(database, { publish: firstPublish }).runOnce(options),
      new OutboxRelayService(database, { publish: secondPublish }).runOnce(options),
    ]);

    expect(processed.reduce((total, count) => total + count, 0)).toBe(1);
    expect(firstPublish.mock.calls.length + secondPublish.mock.calls.length).toBe(1);
  });
});

function makeOrder(): Order {
  return Order.create({
    id: randomUUID(),
    customerId: 'customer-1',
    currency: 'USD',
    items: [{ sku: 'book', quantity: 2, unitPriceMinor: 2_500 }],
  });
}

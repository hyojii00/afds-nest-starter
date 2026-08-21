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
import { asc, eq } from 'drizzle-orm';
import { afterAll, assert, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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

  beforeEach(async () => {
    await database.pool.query('truncate table outbox_events, orders cascade');
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

  it('publishes aggregate versions in order across a transient retry', async () => {
    const order = makeOrder();
    await repository.save(order);
    order.confirm();
    await repository.save(order);
    const publish = vi
      .fn<EventPublisher['publish']>()
      .mockRejectedValueOnce(new Error('broker unavailable'))
      .mockResolvedValue(undefined);
    const relay = new OutboxRelayService(database, { publish });
    const options = { batchSize: 10, maxAttempts: 3, lockTimeoutMs: 60_000 };

    expect(await relay.runOnce(options)).toBe(1);
    let events = await eventsFor(order.snapshot.id);
    expect(events).toMatchObject([
      { aggregateVersion: 1, status: 'PENDING', attempts: 1 },
      { aggregateVersion: 2, status: 'PENDING', attempts: 0 },
    ]);
    expect(await relay.runOnce(options)).toBe(0);

    await database.db
      .update(outboxEvents)
      .set({ availableAt: new Date(0) })
      .where(eq(outboxEvents.id, events[0].id));

    expect(await relay.runOnce(options)).toBe(1);
    expect(await relay.runOnce(options)).toBe(1);
    events = await eventsFor(order.snapshot.id);
    expect(events).toMatchObject([
      { aggregateVersion: 1, status: 'PUBLISHED', attempts: 2, lastError: null },
      { aggregateVersion: 2, status: 'PUBLISHED', attempts: 1, lastError: null },
    ]);
    expect(publish.mock.calls.map(([event]) => event.aggregateVersion)).toEqual([1, 1, 2]);
  });

  it('keeps a successor blocked after its predecessor reaches terminal failure', async () => {
    const order = makeOrder();
    await repository.save(order);
    order.confirm();
    await repository.save(order);
    const relay = new OutboxRelayService(database, {
      publish: vi.fn().mockRejectedValue(new Error('broker unavailable')),
    });
    const options = { batchSize: 10, maxAttempts: 1, lockTimeoutMs: 60_000 };

    expect(await relay.runOnce(options)).toBe(1);
    expect(await relay.runOnce(options)).toBe(0);
    expect(await eventsFor(order.snapshot.id)).toMatchObject([
      { aggregateVersion: 1, status: 'FAILED', attempts: 1 },
      { aggregateVersion: 2, status: 'PENDING', attempts: 0 },
    ]);
  });

  it('recovers a stale claim', async () => {
    const order = makeOrder();
    await repository.save(order);
    await database.db
      .update(outboxEvents)
      .set({ status: 'PROCESSING', attempts: 1, lockedAt: new Date(0) })
      .where(eq(outboxEvents.aggregateId, order.snapshot.id));
    const publish = vi.fn<EventPublisher['publish']>().mockResolvedValue(undefined);
    const relay = new OutboxRelayService(database, { publish });

    expect(await relay.runOnce({ batchSize: 10, maxAttempts: 3, lockTimeoutMs: 60_000 })).toBe(1);
    expect(await eventsFor(order.snapshot.id)).toMatchObject([
      { status: 'PUBLISHED', attempts: 2, lockedAt: null },
    ]);
  });

  it('fails a stale claim that already reached the attempt limit', async () => {
    const order = makeOrder();
    await repository.save(order);
    await database.db
      .update(outboxEvents)
      .set({ status: 'PROCESSING', attempts: 3, lockedAt: new Date(0) })
      .where(eq(outboxEvents.aggregateId, order.snapshot.id));
    const publish = vi.fn<EventPublisher['publish']>().mockResolvedValue(undefined);
    const relay = new OutboxRelayService(database, { publish });

    expect(await relay.runOnce({ batchSize: 10, maxAttempts: 3, lockTimeoutMs: 60_000 })).toBe(0);
    expect(publish).not.toHaveBeenCalled();
    expect(await eventsFor(order.snapshot.id)).toMatchObject([
      {
        status: 'FAILED',
        attempts: 3,
        lockedAt: null,
        lastError: 'processing lease expired after final attempt',
      },
    ]);
  });

  it('prevents a stale relay from overwriting a reclaimed attempt', async () => {
    const order = makeOrder();
    await repository.save(order);
    const firstPublish = deferred<void>();
    const secondPublish = deferred<void>();
    const firstPublisher = vi.fn<EventPublisher['publish']>(() => firstPublish.promise);
    const secondPublisher = vi.fn<EventPublisher['publish']>(() => secondPublish.promise);
    const options = { batchSize: 10, maxAttempts: 3, lockTimeoutMs: 60_000 };

    const firstRun = new OutboxRelayService(database, { publish: firstPublisher }).runOnce(options);
    await vi.waitFor(() => expect(firstPublisher).toHaveBeenCalledOnce());
    await database.db
      .update(outboxEvents)
      .set({ lockedAt: new Date(0) })
      .where(eq(outboxEvents.aggregateId, order.snapshot.id));

    const secondRun = new OutboxRelayService(database, { publish: secondPublisher }).runOnce(
      options,
    );
    await vi.waitFor(() => expect(secondPublisher).toHaveBeenCalledOnce());
    firstPublish.reject(new Error('stale publisher failed'));
    await firstRun;
    expect(await eventsFor(order.snapshot.id)).toMatchObject([
      { status: 'PROCESSING', attempts: 2 },
    ]);

    secondPublish.resolve();
    await secondRun;
    expect(await eventsFor(order.snapshot.id)).toMatchObject([
      { status: 'PUBLISHED', attempts: 2 },
    ]);
  });

  it('does not let simultaneous relays claim the same event', async () => {
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

  it('does not let another relay claim a successor while the head is processing', async () => {
    const order = makeOrder();
    await repository.save(order);
    order.confirm();
    await repository.save(order);
    const pendingPublish = deferred<void>();
    const firstPublish = vi.fn<EventPublisher['publish']>(() => pendingPublish.promise);
    const secondPublish = vi.fn<EventPublisher['publish']>().mockResolvedValue(undefined);
    const options = { batchSize: 10, maxAttempts: 3, lockTimeoutMs: 60_000 };
    const firstRelay = new OutboxRelayService(database, { publish: firstPublish });
    const secondRelay = new OutboxRelayService(database, { publish: secondPublish });

    const firstRun = firstRelay.runOnce(options);
    await vi.waitFor(() => expect(firstPublish).toHaveBeenCalledOnce());
    expect(await secondRelay.runOnce(options)).toBe(0);
    expect(secondPublish).not.toHaveBeenCalled();

    pendingPublish.resolve();
    expect(await firstRun).toBe(1);
    expect(await secondRelay.runOnce(options)).toBe(1);
    expect(secondPublish).toHaveBeenCalledOnce();
    expect(secondPublish.mock.calls[0][0].aggregateVersion).toBe(2);
  });

  async function eventsFor(aggregateId: string) {
    return database.db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.aggregateId, aggregateId))
      .orderBy(asc(outboxEvents.aggregateVersion));
  }
});

function makeOrder(): Order {
  return Order.create({
    id: randomUUID(),
    customerId: 'customer-1',
    currency: 'USD',
    items: [{ sku: 'book', quantity: 2, unitPriceMinor: 2_500 }],
  });
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

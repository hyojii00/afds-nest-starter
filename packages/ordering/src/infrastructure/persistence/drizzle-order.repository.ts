import { DatabaseService, outboxEvents } from '@afds-nest-starter/platform';
import { and, asc, eq } from 'drizzle-orm';
import type { OrderRepository, OrderUnitOfWork } from '../../application/ports';
import { OptimisticLockError } from '../../application/ports';
import { Order, type OrderSnapshot, type OrderStatus } from '../../domain/order';
import { orderItems, orders } from './schema';

export class DrizzleOrderRepository implements OrderRepository, OrderUnitOfWork {
  constructor(private readonly database: DatabaseService) {}

  async findById(id: string): Promise<Order | null> {
    const [row] = await this.database.db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!row) {
      return null;
    }

    const items = await this.database.db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, id))
      .orderBy(asc(orderItems.position));

    return Order.rehydrate({
      id: row.id,
      customerId: row.customerId,
      currency: row.currency,
      status: row.status as OrderStatus,
      totalAmountMinor: row.totalAmountMinor,
      version: row.version,
      cancellationReason: row.cancellationReason,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      items: items.map((item) => ({
        sku: item.sku,
        quantity: item.quantity,
        unitPriceMinor: item.unitPriceMinor,
      })),
    });
  }

  async save(order: Order): Promise<void> {
    const snapshot = order.snapshot;
    const events = order.domainEvents;

    await this.database.db.transaction(async (transaction) => {
      if (order.originalVersion === null) {
        await transaction.insert(orders).values(toOrderRow(snapshot));
        await transaction.insert(orderItems).values(
          snapshot.items.map((item, position) => ({
            orderId: snapshot.id,
            position,
            sku: item.sku,
            quantity: item.quantity,
            unitPriceMinor: item.unitPriceMinor,
          })),
        );
      } else {
        const updated = await transaction
          .update(orders)
          .set({
            status: snapshot.status,
            version: snapshot.version,
            cancellationReason: snapshot.cancellationReason,
            updatedAt: snapshot.updatedAt,
          })
          .where(and(eq(orders.id, snapshot.id), eq(orders.version, order.originalVersion)))
          .returning({ id: orders.id });

        if (updated.length !== 1) {
          throw new OptimisticLockError(`order ${snapshot.id} was changed by another request`);
        }
      }

      if (events.length > 0) {
        await transaction.insert(outboxEvents).values(
          events.map((event) => ({
            id: event.id,
            eventType: event.type,
            aggregateType: 'order',
            aggregateId: event.aggregateId,
            aggregateVersion: event.aggregateVersion,
            occurredAt: event.occurredAt,
            payload: event.payload,
            availableAt: event.occurredAt,
          })),
        );
      }
    });

    order.markPersisted();
  }
}

function toOrderRow(snapshot: OrderSnapshot): typeof orders.$inferInsert {
  return {
    id: snapshot.id,
    customerId: snapshot.customerId,
    currency: snapshot.currency,
    status: snapshot.status,
    totalAmountMinor: snapshot.totalAmountMinor,
    version: snapshot.version,
    cancellationReason: snapshot.cancellationReason,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
  };
}

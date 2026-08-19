import { randomUUID } from 'node:crypto';
import type { DomainEvent } from './domain-event';
import { DomainValidationError, InvalidOrderStateError } from './errors';
import { Money } from './money';

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';

export interface OrderItemSnapshot {
  readonly sku: string;
  readonly quantity: number;
  readonly unitPriceMinor: number;
}

export interface OrderSnapshot {
  readonly id: string;
  readonly customerId: string;
  readonly currency: string;
  readonly status: OrderStatus;
  readonly items: readonly OrderItemSnapshot[];
  readonly totalAmountMinor: number;
  readonly version: number;
  readonly cancellationReason: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateOrderProps {
  readonly id?: string;
  readonly customerId: string;
  readonly currency: string;
  readonly items: readonly OrderItemSnapshot[];
  readonly now?: Date;
}

export class Order {
  private readonly events: DomainEvent[] = [];

  private constructor(
    private state: OrderSnapshot,
    private persistedVersion: number | null,
  ) {}

  static create(props: CreateOrderProps): Order {
    const customerId = props.customerId.trim();
    if (customerId.length === 0) {
      throw new DomainValidationError('customerId is required');
    }
    if (props.items.length === 0) {
      throw new DomainValidationError('an order must contain at least one item');
    }

    const items = props.items.map((item) => validateItem(item));
    const total = items.reduce(
      (sum, item) => sum.add(Money.of(item.unitPriceMinor, props.currency).multiply(item.quantity)),
      Money.of(0, props.currency),
    );
    const now = props.now ?? new Date();
    const order = new Order(
      {
        id: props.id ?? randomUUID(),
        customerId,
        currency: total.currency,
        status: 'PENDING',
        items,
        totalAmountMinor: total.amountMinor,
        version: 1,
        cancellationReason: null,
        createdAt: now,
        updatedAt: now,
      },
      null,
    );

    order.record('ordering.order.created.v1', {
      customerId,
      currency: total.currency,
      totalAmountMinor: total.amountMinor,
      items,
    });
    return order;
  }

  static rehydrate(snapshot: OrderSnapshot): Order {
    return new Order(copySnapshot(snapshot), snapshot.version);
  }

  get snapshot(): OrderSnapshot {
    return copySnapshot(this.state);
  }

  get originalVersion(): number | null {
    return this.persistedVersion;
  }

  get domainEvents(): readonly DomainEvent[] {
    return [...this.events];
  }

  confirm(now = new Date()): void {
    this.assertPending('confirm');
    this.state = {
      ...this.state,
      status: 'CONFIRMED',
      version: this.state.version + 1,
      updatedAt: now,
    };
    this.record('ordering.order.confirmed.v1', { confirmedAt: now.toISOString() });
  }

  cancel(reason: string, now = new Date()): void {
    this.assertPending('cancel');
    const normalizedReason = reason.trim();
    if (normalizedReason.length === 0 || normalizedReason.length > 500) {
      throw new DomainValidationError(
        'cancellation reason must contain between 1 and 500 characters',
      );
    }
    this.state = {
      ...this.state,
      status: 'CANCELLED',
      cancellationReason: normalizedReason,
      version: this.state.version + 1,
      updatedAt: now,
    };
    this.record('ordering.order.cancelled.v1', {
      reason: normalizedReason,
      cancelledAt: now.toISOString(),
    });
  }

  markPersisted(): void {
    this.persistedVersion = this.state.version;
    this.events.length = 0;
  }

  private assertPending(action: string): void {
    if (this.state.status !== 'PENDING') {
      throw new InvalidOrderStateError(`cannot ${action} an order in ${this.state.status} state`);
    }
  }

  private record(type: string, payload: unknown): void {
    this.events.push({
      id: randomUUID(),
      type,
      aggregateId: this.state.id,
      aggregateVersion: this.state.version,
      occurredAt: this.state.updatedAt,
      payload,
    });
  }
}

function validateItem(item: OrderItemSnapshot): OrderItemSnapshot {
  const sku = item.sku.trim();
  if (sku.length === 0 || sku.length > 100) {
    throw new DomainValidationError('sku must contain between 1 and 100 characters');
  }
  if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0) {
    throw new DomainValidationError('quantity must be a positive safe integer');
  }
  if (!Number.isSafeInteger(item.unitPriceMinor) || item.unitPriceMinor < 0) {
    throw new DomainValidationError('unitPriceMinor must be a non-negative safe integer');
  }
  return { sku, quantity: item.quantity, unitPriceMinor: item.unitPriceMinor };
}

function copySnapshot(snapshot: OrderSnapshot): OrderSnapshot {
  return { ...snapshot, items: snapshot.items.map((item) => ({ ...item })) };
}

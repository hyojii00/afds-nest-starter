import { describe, expect, it } from 'vitest';
import { DomainValidationError, InvalidOrderStateError } from './errors';
import { Order } from './order';

const now = new Date('2026-08-19T00:00:00.000Z');

describe('Order', () => {
  it('creates a pending order and records its total and event', () => {
    const order = Order.create({
      id: '0198c100-0000-7000-8000-000000000001',
      customerId: 'customer-1',
      currency: 'KRW',
      items: [
        { sku: 'coffee', quantity: 2, unitPriceMinor: 4_500 },
        { sku: 'cake', quantity: 1, unitPriceMinor: 6_000 },
      ],
      now,
    });

    expect(order.snapshot).toMatchObject({
      status: 'PENDING',
      totalAmountMinor: 15_000,
      version: 1,
    });
    expect(order.domainEvents).toMatchObject([
      { type: 'ordering.order.created.v1', aggregateVersion: 1 },
    ]);
  });

  it('rejects an empty order', () => {
    expect(() =>
      Order.create({ customerId: 'customer-1', currency: 'KRW', items: [], now }),
    ).toThrow(DomainValidationError);
  });

  it('confirms a pending order exactly once', () => {
    const order = makeOrder();
    order.confirm(now);

    expect(order.snapshot).toMatchObject({ status: 'CONFIRMED', version: 2 });
    expect(() => order.confirm(now)).toThrow(InvalidOrderStateError);
  });

  it('requires a cancellation reason and rejects later confirmation', () => {
    const order = makeOrder();
    expect(() => order.cancel('')).toThrow(DomainValidationError);

    order.cancel('customer request', now);
    expect(order.snapshot).toMatchObject({
      status: 'CANCELLED',
      cancellationReason: 'customer request',
    });
    expect(() => order.confirm(now)).toThrow(InvalidOrderStateError);
  });

  it('clears events only after persistence is acknowledged', () => {
    const order = makeOrder();
    expect(order.domainEvents).toHaveLength(1);
    order.markPersisted();
    expect(order.domainEvents).toHaveLength(0);
    expect(order.originalVersion).toBe(1);
  });
});

function makeOrder(): Order {
  return Order.create({
    customerId: 'customer-1',
    currency: 'USD',
    items: [{ sku: 'book', quantity: 1, unitPriceMinor: 2_500 }],
    now,
  });
}

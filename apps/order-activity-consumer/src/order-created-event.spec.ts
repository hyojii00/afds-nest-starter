import type { IntegrationEventEnvelope } from '@afds-nest-starter/platform';
import { describe, expect, it } from 'vitest';
import { toOrderActivity } from './order-created-event';

const event: IntegrationEventEnvelope = {
  eventId: '0198c100-0000-7000-8000-000000000001',
  eventType: 'ordering.order.created.v1',
  aggregateType: 'order',
  aggregateId: '0198c100-0000-7000-8000-000000000002',
  aggregateVersion: 1,
  occurredAt: '2026-08-19T00:00:00.000Z',
  payload: {
    customerId: 'customer-1',
    currency: 'KRW',
    totalAmountMinor: 15_000,
    items: [],
  },
};

describe('order-created event mapping', () => {
  it('maps a versioned envelope to an activity projection', () => {
    expect(toOrderActivity(event)).toEqual({
      eventId: event.eventId,
      orderId: event.aggregateId,
      customerId: 'customer-1',
      currency: 'KRW',
      totalAmountMinor: 15_000,
      occurredAt: new Date(event.occurredAt),
    });
  });

  it('ignores event types owned by other projections', () => {
    expect(toOrderActivity({ ...event, eventType: 'ordering.order.confirmed.v1' })).toBeNull();
  });

  it('rejects an invalid order-created payload', () => {
    expect(() => toOrderActivity({ ...event, payload: { customerId: 'customer-1' } })).toThrow(
      'invalid ordering.order.created.v1 payload',
    );
  });
});

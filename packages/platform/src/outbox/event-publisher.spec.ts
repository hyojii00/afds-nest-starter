import { describe, expect, it } from 'vitest';
import { decodeIntegrationEvent } from './event-publisher';

describe('integration event decoding', () => {
  it('decodes a complete versioned envelope', () => {
    const event = {
      eventId: 'event-1',
      eventType: 'ordering.order.created.v1',
      aggregateType: 'order',
      aggregateId: 'order-1',
      aggregateVersion: 1,
      occurredAt: '2026-08-19T00:00:00.000Z',
      payload: { customerId: 'customer-1' },
    };

    expect(decodeIntegrationEvent(Buffer.from(JSON.stringify(event)))).toEqual(event);
  });

  it.each([null, Buffer.from('{'), Buffer.from('{}')])('rejects an invalid envelope', (value) => {
    expect(() => decodeIntegrationEvent(value)).toThrow('invalid integration event envelope');
  });
});

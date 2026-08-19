import type { IntegrationEventEnvelope } from '@afds-nest-starter/platform';

export interface OrderActivityRecord {
  readonly eventId: string;
  readonly orderId: string;
  readonly customerId: string;
  readonly currency: string;
  readonly totalAmountMinor: number;
  readonly occurredAt: Date;
}

export function toOrderActivity(event: IntegrationEventEnvelope): OrderActivityRecord | null {
  if (event.eventType !== 'ordering.order.created.v1') {
    return null;
  }

  const payload = event.payload;
  const occurredAt = new Date(event.occurredAt);
  if (
    event.aggregateType !== 'order' ||
    !isRecord(payload) ||
    typeof payload.customerId !== 'string' ||
    payload.customerId.length === 0 ||
    typeof payload.currency !== 'string' ||
    !/^[A-Z]{3}$/.test(payload.currency) ||
    !Number.isSafeInteger(payload.totalAmountMinor) ||
    (payload.totalAmountMinor as number) < 0 ||
    Number.isNaN(occurredAt.getTime())
  ) {
    throw new Error('invalid ordering.order.created.v1 payload');
  }

  return {
    eventId: event.eventId,
    orderId: event.aggregateId,
    customerId: payload.customerId,
    currency: payload.currency,
    totalAmountMinor: payload.totalAmountMinor as number,
    occurredAt,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

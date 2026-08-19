export interface IntegrationEventEnvelope {
  readonly eventId: string;
  readonly eventType: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly aggregateVersion: number;
  readonly occurredAt: string;
  readonly payload: unknown;
}

export interface EventPublisher {
  publish(event: IntegrationEventEnvelope): Promise<void>;
}

export const EVENT_PUBLISHER = Symbol('EVENT_PUBLISHER');

export function decodeIntegrationEvent(value: Buffer | null): IntegrationEventEnvelope {
  let candidate: unknown;
  try {
    candidate = value ? JSON.parse(value.toString('utf8')) : null;
  } catch {
    throw new Error('invalid integration event envelope');
  }

  if (
    !isRecord(candidate) ||
    typeof candidate.eventId !== 'string' ||
    typeof candidate.eventType !== 'string' ||
    typeof candidate.aggregateType !== 'string' ||
    typeof candidate.aggregateId !== 'string' ||
    !Number.isSafeInteger(candidate.aggregateVersion) ||
    typeof candidate.occurredAt !== 'string' ||
    !Object.hasOwn(candidate, 'payload')
  ) {
    throw new Error('invalid integration event envelope');
  }

  return {
    eventId: candidate.eventId,
    eventType: candidate.eventType,
    aggregateType: candidate.aggregateType,
    aggregateId: candidate.aggregateId,
    aggregateVersion: candidate.aggregateVersion as number,
    occurredAt: candidate.occurredAt,
    payload: candidate.payload,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

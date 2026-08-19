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

export interface DomainEvent<TPayload = unknown> {
  readonly id: string;
  readonly type: string;
  readonly aggregateId: string;
  readonly aggregateVersion: number;
  readonly occurredAt: Date;
  readonly payload: TPayload;
}

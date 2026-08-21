import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, asc, eq, inArray, lt, lte, ne, notExists, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { DatabaseService } from '../database/database.service';
import {
  EVENT_PUBLISHER,
  type EventPublisher,
  type IntegrationEventEnvelope,
} from './event-publisher';
import { outboxEvents, type OutboxEventRow } from './schema';

const earlierOutboxEvent = alias(outboxEvents, 'earlier_outbox_event');

export interface RelayOptions {
  readonly batchSize: number;
  readonly maxAttempts: number;
  readonly lockTimeoutMs: number;
}

@Injectable()
export class OutboxRelayService {
  private readonly logger = new Logger(OutboxRelayService.name);

  constructor(
    private readonly database: DatabaseService,
    @Inject(EVENT_PUBLISHER) private readonly publisher: EventPublisher,
  ) {}

  async runOnce(options: RelayOptions): Promise<number> {
    const events = await this.claimBatch(options.batchSize, options.lockTimeoutMs);

    for (const event of events) {
      await this.publishOne(event, options.maxAttempts);
    }

    return events.length;
  }

  private async claimBatch(batchSize: number, lockTimeoutMs: number): Promise<OutboxEventRow[]> {
    return this.database.db.transaction(async (transaction) => {
      const now = new Date();
      const staleBefore = new Date(now.getTime() - lockTimeoutMs);

      await transaction
        .update(outboxEvents)
        .set({ status: 'PENDING', lockedAt: null })
        .where(and(eq(outboxEvents.status, 'PROCESSING'), lt(outboxEvents.lockedAt, staleBefore)));

      const claimed = await transaction
        .select()
        .from(outboxEvents)
        .where(
          and(
            eq(outboxEvents.status, 'PENDING'),
            lte(outboxEvents.availableAt, now),
            notExists(
              transaction
                .select({ id: earlierOutboxEvent.id })
                .from(earlierOutboxEvent)
                .where(
                  and(
                    eq(earlierOutboxEvent.aggregateType, outboxEvents.aggregateType),
                    eq(earlierOutboxEvent.aggregateId, outboxEvents.aggregateId),
                    lt(earlierOutboxEvent.aggregateVersion, outboxEvents.aggregateVersion),
                    ne(earlierOutboxEvent.status, 'PUBLISHED'),
                  ),
                ),
            ),
          ),
        )
        .orderBy(
          asc(outboxEvents.createdAt),
          asc(outboxEvents.aggregateVersion),
          asc(outboxEvents.id),
        )
        .limit(batchSize)
        .for('update', { skipLocked: true });

      if (claimed.length === 0) {
        return [];
      }

      const ids = claimed.map((event) => event.id);
      await transaction
        .update(outboxEvents)
        .set({
          status: 'PROCESSING',
          lockedAt: now,
          attempts: sql`${outboxEvents.attempts} + 1`,
        })
        .where(inArray(outboxEvents.id, ids));

      return claimed.map((event) => ({
        ...event,
        status: 'PROCESSING',
        lockedAt: now,
        attempts: event.attempts + 1,
      }));
    });
  }

  private async publishOne(event: OutboxEventRow, maxAttempts: number): Promise<void> {
    try {
      await this.publisher.publish(this.toEnvelope(event));
      await this.database.db
        .update(outboxEvents)
        .set({ status: 'PUBLISHED', publishedAt: new Date(), lockedAt: null, lastError: null })
        .where(
          and(
            eq(outboxEvents.id, event.id),
            eq(outboxEvents.status, 'PROCESSING'),
            eq(outboxEvents.attempts, event.attempts),
          ),
        );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const failed = event.attempts >= maxAttempts;
      const retryDelayMs = Math.min(2 ** Math.max(event.attempts - 1, 0) * 1_000, 60_000);

      await this.database.db
        .update(outboxEvents)
        .set({
          status: failed ? 'FAILED' : 'PENDING',
          availableAt: new Date(Date.now() + retryDelayMs),
          lockedAt: null,
          lastError: message.slice(0, 4_000),
        })
        .where(
          and(
            eq(outboxEvents.id, event.id),
            eq(outboxEvents.status, 'PROCESSING'),
            eq(outboxEvents.attempts, event.attempts),
          ),
        );

      this.logger.error(
        JSON.stringify({
          message: 'integration_event_publish_failed',
          eventId: event.id,
          failed,
          error: message,
        }),
      );
    }
  }

  private toEnvelope(event: OutboxEventRow): IntegrationEventEnvelope {
    return {
      eventId: event.id,
      eventType: event.eventType,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      aggregateVersion: event.aggregateVersion,
      occurredAt: event.occurredAt.toISOString(),
      payload: event.payload,
    };
  }
}

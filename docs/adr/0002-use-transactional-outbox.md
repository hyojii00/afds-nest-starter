# ADR 0002: Use a Transactional Outbox

- Status: accepted
- Date: 2026-08-19

## Context

Persisting an order and publishing its event as unrelated operations can lose an event or publish a state that never committed. Starting with Kafka or RabbitMQ would add operational scope without changing that atomicity problem.

## Decision

Store versioned integration-event envelopes in PostgreSQL in the same transaction as each order change. Run a separate worker that claims rows with `FOR UPDATE SKIP LOCKED`, publishes through a port, and records success or retry state. Claim only aggregate heads whose lower versions are all published, and use the incrementing attempt number as a fencing token when recording completion. Requeue an expired claim only below the attempt limit; otherwise mark it failed for manual recovery.

The selected broker adapter is recorded separately in [ADR 0004](0004-use-kafka-for-integration-events.md); the Outbox contract remains independent of that choice.

## Alternatives

- In-process events alone were simple but disappeared on process failure.
- Direct broker publish could not be atomic with PostgreSQL.
- Event sourcing made events the source of truth and introduced a much larger modeling and migration commitment.

## Consequences

The database is the durable handoff boundary and the API does not wait for external delivery. Delivery is at least once, so consumers must deduplicate event IDs. A retrying or failed event delays later versions of the same aggregate but not other aggregates. Attempt fencing protects Outbox state from an expired relay, but it cannot prevent duplicate broker records. Failed and stale rows require monitoring and operational recovery.

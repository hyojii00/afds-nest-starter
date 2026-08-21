# ADR 0004: Use Kafka for Integration Events

- Status: accepted
- Date: 2026-08-19

## Context

The Outbox relay previously ended at a console publisher, so it demonstrated persistence and retry state without proving delivery to another independently runnable process. The starter needs one small, real event-driven path while preserving the Outbox atomicity boundary and keeping the ordering context independent of broker code.

## Decision

Publish Outbox envelopes to Kafka through an adapter owned by the Outbox worker. Use the configured topic, key records by aggregate ID, require broker acknowledgement, and retain the relay's at-least-once behavior.

Run a separate order-activity consumer group that writes a PostgreSQL projection. Commit each Kafka offset only after the database write succeeds and use the event ID as the projection primary key so repeated delivery is idempotent. Log invalid owned events with their topic, partition, and offset, then leave them uncommitted for deliberate operator recovery; automated dead-letter handling is outside this starter's scope. Use Apache Kafka's official single-node KRaft image for local development and the Confluent JavaScript client for Node.js applications.

## Alternatives

- Keeping the console publisher preserved the smallest runtime but did not demonstrate integration between processes.
- RabbitMQ offered a smaller queue-oriented example but did not emphasize partition keys, retained events, consumer offsets, and replay.
- Publishing directly from the API removed the relay process but lost atomicity between PostgreSQL state and external delivery.

## Consequences

Local development now requires Kafka in addition to PostgreSQL. Delivery remains at least once across the Outbox and consumer boundaries, so consumers must be idempotent. The consumer requests topic creation to support either local process start order. An invalid owned event blocks its partition until an operator resolves or skips it, which trades automation for a smaller and explicit failure policy. The local single-node broker is not highly available, and production deployments must own replication, security, monitoring, dead-letter policy, and topic policy. Versioned JSON envelopes avoid a schema-registry dependency in this starter but require consumer-side validation.

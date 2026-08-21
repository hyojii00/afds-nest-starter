# Local Development Runbook

## Architecture demo

Run the complete API-to-projection path with one command:

```bash
pnpm demo
```

The command starts PostgreSQL and Kafka, applies migrations, builds with SWC, runs the API, worker, and consumer, creates an order, and waits for matching `PUBLISHED` Outbox and `order_activity` records. It stops the three application processes when finished but retains the Docker containers and database evidence. It requires port 3000, or the configured `PORT`, to be free.

## Start

```bash
fnm use --install-if-missing
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
docker compose up -d --wait postgres kafka
pnpm db:migrate
pnpm dev:api
```

Start `pnpm dev:worker` and `pnpm dev:consumer` in separate terminals. Check `/health/ready` before using the API.

The Compose services bind PostgreSQL and unauthenticated development Kafka to `127.0.0.1` only. They are local tooling and must not be exposed as a production deployment.

## Schema changes

Edit the owning Drizzle schema, run `pnpm db:generate`, inspect the generated SQL, start PostgreSQL, and run `pnpm db:migrate`. Commit schema and migration together. Never edit a migration that has been shared; add a new migration.

## Outbox recovery

The worker automatically returns stale `PROCESSING` rows to `PENDING` after `OUTBOX_LOCK_TIMEOUT_MS`. Transient failures receive exponential backoff capped at 60 seconds. Rows become `FAILED` after `OUTBOX_MAX_ATTEMPTS` and remain durable for diagnosis. A retrying or failed row blocks later versions of the same aggregate while unrelated aggregates continue. Reclaimed attempts are fenced by their incrementing attempt number, although duplicate Kafka records remain possible and safe only for idempotent consumers.

Before manually retrying a failed event, verify whether the destination already processed its event ID. After correction, set the row to `PENDING`, clear `locked_at`, set `available_at` to the current time, and retain `attempts` and `last_error` as evidence. This manual database operation is intentionally not automated in the starter.

## Kafka inspection and recovery

List or describe the local topic from the Kafka container:

```bash
docker compose exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list
docker compose exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --describe --topic ordering.events
```

The worker waits for broker acknowledgement before marking an Outbox row as published. The consumer writes the projection before committing its Kafka offset. Restart either process after a transient failure; duplicate event delivery is safe because `order_activity.event_id` is unique.

An invalid owned event emits `integration_event_processing_failed` with its topic, partition, and offset and remains uncommitted. Kafka records are immutable, so they cannot be corrected in place. Stop the consumer and inspect the exact record reported by the log:

```bash
docker compose exec kafka /opt/kafka/bin/kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic ordering.events \
  --partition <partition> \
  --offset <offset> \
  --max-messages 1
```

Prefer deploying a compatible handler and restarting the consumer at the same uncommitted offset. If the projection can intentionally omit the event, record the impact and advance only this consumer group to the next offset while the consumer is stopped:

```bash
docker compose exec kafka /opt/kafka/bin/kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --group order-activity \
  --topic ordering.events:<partition> \
  --reset-offsets \
  --to-offset <next-offset> \
  --execute
```

Use the configured topic and group names when they differ from `.env.example`. Skipping loses this projection for the group and is intentionally never automatic in the starter.

## Stop and reset

`docker compose down` removes the local Kafka container and its development-only log while retaining PostgreSQL data. `docker compose down --volumes` also permanently removes the local database and is appropriate only when the developer explicitly wants a clean local environment.

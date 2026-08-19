# Local Development Runbook

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

## Schema changes

Edit the owning Drizzle schema, run `pnpm db:generate`, inspect the generated SQL, start PostgreSQL, and run `pnpm db:migrate`. Commit schema and migration together. Never edit a migration that has been shared; add a new migration.

## Outbox recovery

The worker automatically returns stale `PROCESSING` rows to `PENDING` after `OUTBOX_LOCK_TIMEOUT_MS`. Transient failures receive exponential backoff capped at 60 seconds. Rows become `FAILED` after `OUTBOX_MAX_ATTEMPTS` and remain durable for diagnosis.

Before manually retrying a failed event, verify whether the destination already processed its event ID. After correction, set the row to `PENDING`, clear `locked_at`, set `available_at` to the current time, and retain `attempts` and `last_error` as evidence. This manual database operation is intentionally not automated in the starter.

## Kafka inspection and recovery

List or describe the local topic from the Kafka container:

```bash
docker compose exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list
docker compose exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --describe --topic ordering.events
```

The worker waits for broker acknowledgement before marking an Outbox row as published. The consumer writes the projection before committing its Kafka offset. Restart either process after a transient failure; duplicate event delivery is safe because `order_activity.event_id` is unique. Inspect and correct an invalid owned event before resetting consumer offsets manually.

## Stop and reset

`docker compose down` removes the local Kafka container and its development-only log while retaining PostgreSQL data. `docker compose down --volumes` also permanently removes the local database and is appropriate only when the developer explicitly wants a clean local environment.

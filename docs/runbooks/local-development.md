# Local Development Runbook

## Start

```bash
fnm use --install-if-missing
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
docker compose up -d postgres
pnpm db:migrate
pnpm dev:api
```

Start `pnpm dev:worker` separately. Check `/health/ready` before using the API.

## Schema changes

Edit the owning Drizzle schema, run `pnpm db:generate`, inspect the generated SQL, start PostgreSQL, and run `pnpm db:migrate`. Commit schema and migration together. Never edit a migration that has been shared; add a new migration.

## Outbox recovery

The worker automatically returns stale `PROCESSING` rows to `PENDING` after `OUTBOX_LOCK_TIMEOUT_MS`. Transient failures receive exponential backoff capped at 60 seconds. Rows become `FAILED` after `OUTBOX_MAX_ATTEMPTS` and remain durable for diagnosis.

Before manually retrying a failed event, verify whether the destination already processed its event ID. After correction, set the row to `PENDING`, clear `locked_at`, set `available_at` to the current time, and retain `attempts` and `last_error` as evidence. This manual database operation is intentionally not automated in the starter.

## Stop and reset

`docker compose down` stops PostgreSQL without deleting data. `docker compose down --volumes` permanently removes the local database and is appropriate only when the developer explicitly wants a clean local environment.

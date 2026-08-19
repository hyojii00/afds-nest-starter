# Contributing

## Setup

Use Node.js `24.19.0` and pnpm `11.22.0`. Copy `.env.example` to `.env`, start PostgreSQL with `docker compose up -d postgres`, and run `pnpm db:migrate`.

## Change policy

- Branch from `main` with `feat/<short-name>`, `fix/<short-name>`, or `docs/<short-name>`.
- Keep commits and pull requests focused on one behavior or ownership area.
- Do not change public contracts, dependencies, or architecture without recording the decision and impact.
- Follow [WORKFLOW.md](WORKFLOW.md) and update the affected AFDS owner in the same pull request.

## Validation

Use the narrowest relevant command while developing:

- `pnpm test:unit` for domain and application behavior.
- `pnpm test:integration` for PostgreSQL, transactions, optimistic locking, and Outbox delivery.
- `pnpm test:e2e` for HTTP contracts, health, and OpenAPI.
- `pnpm check:boundaries` for dependency direction.
- `pnpm typecheck` for TypeScript declarations and `pnpm build` for SWC output.
- `pnpm validate:docs` for AFDS owners, links, ADR identifiers, and Mermaid syntax.

Run `pnpm verify` before opening or updating a pull request. Docker must be available for the integration and E2E suites.

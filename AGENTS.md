# AGENTS.md

This is the entry point for humans and AI agents working in this repository. Keep it short; durable detail belongs to the AFDS owner documents linked from [MAP.md](MAP.md).

## Critical rules

- Do not commit secrets, `.env` files, raw prompts, temporary plans, or validation logs.
- Do not add dependencies or expand product scope without an explicit requirement.
- Preserve domain purity: ordering domain and application code must not import NestJS, Drizzle, or platform adapters.
- Do not edit unrelated code or overwrite work you did not create.
- Update the owning AFDS document in the same change when behavior, architecture, policy, or operations change.

## Working loop

1. Read [MAP.md](MAP.md), [WORKFLOW.md](WORKFLOW.md), and the relevant owner document.
2. Define observable success criteria before editing.
3. Make the smallest change and run the narrowest relevant check.
4. Use exact failures as feedback; do not broaden the change without evidence.
5. Run `pnpm verify` and review the diff before closeout.

## Core commands

| Task | Command |
| --- | --- |
| Install | `pnpm install --frozen-lockfile` |
| Start dependencies | `docker compose up -d --wait postgres kafka` |
| Apply migrations | `pnpm db:migrate` |
| Start API / worker / consumer | `pnpm dev:api` / `pnpm dev:worker` / `pnpm dev:consumer` |
| Focused tests | `pnpm test:unit`, `pnpm test:integration`, `pnpm test:e2e` |
| Full verification | `pnpm verify` |

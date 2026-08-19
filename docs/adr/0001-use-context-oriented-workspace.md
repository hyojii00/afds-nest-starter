# ADR 0001: Use a Context-Oriented pnpm Workspace

- Status: accepted
- Date: 2026-08-19

## Context

The starter must show DDD boundaries clearly while keeping one example understandable to a reviewer. A single application hides package dependencies; a package per layer creates excessive navigation and configuration.

## Decision

Use four packages: API, Outbox worker, ordering context, and platform. Keep domain, application, infrastructure, and presentation as internal ordering layers and enforce their direction statically.

## Alternatives

- A single Nest application was simpler but provided weak physical dependency evidence.
- A package per DDD layer provided stronger isolation but overcomplicated one bounded context.
- Nest CLI monorepo mode shared one dependency manifest and made package ownership less explicit.

## Consequences

Package dependencies and runtime processes are visible without introducing a build orchestrator. Internal layer rules require dependency-cruiser because workspace boundaries alone cannot enforce them.

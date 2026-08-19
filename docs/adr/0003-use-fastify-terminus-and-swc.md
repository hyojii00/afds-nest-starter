# ADR 0003: Use Fastify, Terminus, and SWC

- Status: accepted
- Date: 2026-08-19

## Context

The API needs an explicit HTTP runtime, observable dependency health, and a fast compiler without weakening TypeScript validation. Keeping these choices implicit would make the starter harder for humans and AI agents to inspect consistently.

## Decision

Run NestJS on the Fastify adapter, implement liveness and PostgreSQL readiness through Nest Terminus, and use SWC to emit JavaScript. Continue running TypeScript in declaration-only mode so type errors and workspace declarations remain part of the build contract.

## Alternatives

- Express is Nest's familiar default but is not the selected runtime for this starter.
- Hand-written health responses are smaller but do not provide Terminus' consistent health envelope and failure semantics.
- TypeScript-only emission requires fewer tools but makes compilation slower; SWC alone does not provide type checking or declarations.

## Consequences

Fastify-specific bootstrap and test setup must stay aligned. Health responses follow Terminus rather than the previous custom shape. SWC and TypeScript configurations are both required: TypeScript validates and emits declarations, then SWC emits runnable JavaScript.

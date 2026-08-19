# AFDS Documentation Standard

AFDS means Agent-First Documentation System. Its purpose is to give humans and AI agents one active owner for each durable truth while keeping temporary execution state out of the repository.

## Mandatory owners

| Owner | Purpose |
| --- | --- |
| `AGENTS.md` | Short repository entry point and critical constraints |
| `MAP.md` | Navigation to the canonical owner for each question |
| `WORKFLOW.md` | Shaping, execution, verification, and closeout |
| `CONTRIBUTING.md` | Setup, branch, review, and validation policy |
| `docs/specs/` | Exact external behavior and invariants |
| `docs/arch/` | Boundaries, dependencies, data flow, and event flow |
| `docs/guidelines/` | Durable team rules and reusable procedures |
| `docs/runbooks/` | Operational procedures and recovery |

Use `docs/adr/` for long-lived decisions with meaningful alternatives or consequences.

## Documentation impact gate

- Behavior or error semantics changed: update `docs/specs/`.
- Package boundaries, persistence, event flow, or runtime topology changed: update `docs/arch/` and possibly an ADR.
- Team rules or AI workflow changed: update `docs/guidelines/`.
- Setup, migration, recovery, or manual operations changed: update `docs/runbooks/`.
- Only temporary investigation or execution state changed: keep it in the issue, pull request, or local `.ephemeral/` workspace.

An owner update ships in the same pull request as the change that makes it true. Do not duplicate active truth in a second document; link to the owner instead.

## Durable-document hygiene

- State current behavior, not task history.
- Keep validation logs, issue status, PR discussion, and raw AI transcripts transient.
- Prefer reviewable Mermaid source for architecture diagrams.
- Keep local links valid and ADR identifiers unique; `pnpm validate:docs` enforces these checks.

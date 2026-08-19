# AI-Assisted Development

AI accelerates exploration, planning, implementation, tests, and review. It does not own product intent or decide that its own output is correct.

## Responsibility boundary

The human owns goals, risk acceptance, public-contract choices, dependency approval, and final review. The agent must surface assumptions, work from repository evidence, keep changes surgical, and provide exact validation outcomes.

## Required loop

1. **Orient:** read `AGENTS.md`, `MAP.md`, and the relevant owners before editing.
2. **Specify:** translate the request into observable behavior, constraints, and a stop condition.
3. **Prove:** add or select the narrowest test or static check that can demonstrate success.
4. **Implement:** make the minimum change and preserve dependency direction.
5. **React to evidence:** read exact failures, correct the smallest cause, and repeat the same command.
6. **Broaden validation:** progress from focused tests to `pnpm verify`.
7. **Critique:** inspect the diff for scope creep, accidental contracts, missing tests, and stale owner docs.
8. **Disclose:** record AI scope, human decisions, commands and outcomes, documentation impact, and residual risk in the pull request.

## Durable evidence

Durable evidence consists of current owner documents, executable tests, dependency rules, migrations, and CI results. Raw prompts, chat transcripts, generated plans, and copied command logs are transient because they become stale and obscure the active source of truth.

# Development Workflow

## Shape

Use the shape path when behavior, architecture, policy, or operations are ambiguous.

1. Describe the intended externally observable result and non-goals.
2. Find the current owner through [MAP.md](MAP.md).
3. Record only stable requirements or decisions in that owner.
4. Keep task checklists, prompt history, experiments, and validation output outside durable documentation.

## Execute

1. Add or adjust the narrowest test that proves the requirement.
2. Make the smallest implementation change that can pass it.
3. Re-run the exact failed command after each correction.
4. Run progressively broader checks only after the focused check passes.

## Close

1. Apply the documentation impact gate in the [documentation standard](docs/guidelines/documentation-standard.md).
2. Run `pnpm verify`.
3. Inspect the complete diff for unrelated edits, unnecessary abstraction, public-contract changes, and missing cleanup.
4. Report changed behavior, files, exact command outcomes, documentation impact, and residual risk.

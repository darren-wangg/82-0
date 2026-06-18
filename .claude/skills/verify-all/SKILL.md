---
name: verify-all
description: Run 82-0's full verification gate — typecheck, lint, tests, then production build — and report exactly what passes or fails. Use before committing or when asked to verify the project is green.
allowed-tools: Bash
---

Run the project's verification gate **in this order**, stopping at the first
failure and showing the relevant output:

1. `npx tsc --noEmit` — type errors
2. `npm run lint` — ESLint
3. `npm test` — vitest (engine + contract tests)
4. `npm run build` — production build (runs `prisma generate` first; must stay green)

Report a short pass/fail line per step. On failure, quote only the failing
output (not the whole log) and stop — don't run later steps. If all four pass,
say so plainly: the branch is green.

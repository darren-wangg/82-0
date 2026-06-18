# `.claude/` — agent tooling for 82-0

Checked-in Claude Code configuration so every contributor (and every agent run)
inherits the same guardrails and shortcuts. All of it is project-scoped; nothing
here is machine-specific.

## Hooks (`settings.json` + `hooks/`)

| Event | Script | What it does |
|---|---|---|
| `PreToolUse` (Edit/Write/MultiEdit) | `hooks/guard-frozen.mjs` | **Denies edits to `src/lib/contracts.ts`** — the FROZEN contract surface. Override for a deliberate contract change by starting the session with `ALLOW_CONTRACTS_EDIT=1`. |
| `PostToolUse` (Edit/Write/MultiEdit) | `hooks/lint-changed.mjs` | Runs ESLint on just the changed `.ts/.tsx` file under `src|scripts` and feeds any errors back so they're fixed in the same turn. Fails open on tooling errors. |

The hooks are deliberately narrow. The fuzzier rules (engine/data import
boundaries, server authority) are left to the **contracts-guard** agent, which
can apply judgment instead of pattern-matching and producing false denials.

## Skills (`skills/`)

| Command | Invocation | Purpose |
|---|---|---|
| `/verify-all` | you or Claude | Run the full gate: `tsc --noEmit` → lint → `npm test` → `npm run build`, stop at first failure. |
| `/sync-i18n` | you or Claude | Add/update a key across all 9 `messages/*.json` (`add-key.mjs`) and check key parity (`check-parity.mjs`). |
| `/etl-rebuild` | manual only | Reference procedure for rebuilding the player snapshot + headshots, with the CC BY-SA attribution and `estimatedCats` rules. `disable-model-invocation: true`. |

## Agents (`agents/`)

| Agent | Use |
|---|---|
| `contracts-guard` | Read-only reviewer. Checks the working diff against the AGENTS.md hard rules (frozen contracts, engine/data access, server authority, path ownership) and reports findings — never edits. Run before committing changes to `src/lib`, `src/engine`, or API routes. |

## Disabling

Remove or comment a hook entry in `settings.json` to turn it off; delete a skill
or agent directory to drop it. The hooks degrade safely — if `node` or ESLint
isn't available they allow the action rather than blocking work.

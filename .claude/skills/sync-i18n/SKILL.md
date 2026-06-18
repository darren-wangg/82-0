---
name: sync-i18n
description: Add or update a translation key across all 9 next-intl message catalogs at once, and verify key parity. Use whenever a new user-facing string is introduced or a catalog drifts out of sync.
allowed-tools: Bash
argument-hint: [namespace.key]
---

This project ships 9 locales (`messages/{en,es,fr,de,it,pt,zh,ja,ko}.json`).
Every user-facing string must exist in **all 9** with the same key path, or
next-intl throws at render. This skill keeps them in lockstep.

## Add or update a key

1. Decide the dotted key path (e.g. `sim.nameRejected`, `myTeams.submit`) and
   write a real translation for **each** locale — do not paste English into
   the other 8.
2. Apply it everywhere in one shot:

   ```bash
   node .claude/skills/sync-i18n/add-key.mjs <namespace.key> '{
     "en":"…","es":"…","fr":"…","de":"…","it":"…",
     "pt":"…","zh":"…","ja":"…","ko":"…"
   }'
   ```

   The script writes into every catalog, preserves 2-space indentation and the
   trailing newline, and refuses to run if any locale is missing a value.

## Always verify parity afterward

```bash
node .claude/skills/sync-i18n/check-parity.mjs
```

Exits non-zero and lists the offending keys if any catalog has missing or extra
keys relative to `en.json`. Run it after any manual edit to `messages/*.json`
too — it's the fast catch for drift.

If `$ARGUMENTS` names a specific key, scope the work to that key.

---
name: etl-rebuild
description: Reference procedure for rebuilding the player-data snapshot and headshots from the open dataset. Manual-only — never run automatically.
disable-model-invocation: true
allowed-tools: Bash
---

The one-time ETL that produces the player snapshot the whole app reads through
`src/lib/snapshot.ts`. Run only when intentionally refreshing the dataset.

## Rules (from AGENTS.md)

- Source is the open, Basketball-Reference-derived dataset (**CC BY-SA — keep
  the attribution**). No live sports APIs; **do not scrape
  basketball-reference.com**.
- Output is `public/data/snapshot-v1.json`. Game/API code reads it only via
  `src/lib/snapshot.ts` (and `snapshot-client.ts`) — never import the JSON
  directly into feature code.
- Pre-1974 STL/BLK/TOV and old-era ratings are estimates; the pipeline sets the
  `estimatedCats` flag so the UI can mark them "est." Preserve that flag.

## Steps

```bash
npm run etl                 # build snapshot-v1.json
npm run etl:headshots       # resolve NBA-CDN headshot URLs (unofficial)
npm run etl:bake-headshots  # bake the fallback/silhouette map
```

After a rebuild, bump the snapshot `version` so teams saved against older data
are correctly treated as stale, then run `/verify-all`.

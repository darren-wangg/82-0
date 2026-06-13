/**
 * Franchise×decade combos that are NOT draftable — removed from the snapshot so
 * the slot machine can never land on them.
 *
 * These are the 10 weakest combos by the strength of the best player you could
 * draft from them (era-adjusted composite, the same score the engine uses).
 * They're mostly expansion teams' first partial decade (Heat/Hornets entered
 * 1988, Raptors/Grizzlies 1995, ABA-era Nets) or a team's barren stretch —
 * pools whose best available pick is a fringe rotation player.
 *
 * Regenerate the ranking with: node --import tsx scripts/etl/rank-pools.ts
 *
 * Keys are `${franchiseId}|${decade}`. Applied in build.ts AFTER era baselines
 * are computed, so excluding them does not shift any other player's rating.
 */
export const EXCLUDED_POOLS: ReadonlySet<string> = new Set([
  "MIA|1980s", // Miami Heat — entered 1988 (best: Grant Long)
  "CHA|1980s", // Charlotte Hornets — entered 1988 (best: Kurt Rambis)
  "TOR|1990s", // Toronto Raptors — entered 1995 (best: Damon Stoudamire)
  "BKN|1960s", // Nets — ABA infancy (best: Dan Anderson)
  "BKN|2010s", // Nets — post-superteam rebuild (best: Jarrett Allen)
  "MEM|1990s", // Grizzlies — entered 1995 as Vancouver (best: Shareef Abdur-Rahim)
  "SAC|1980s", // Kings — lean Kansas City/Sacramento years (best: Reggie King)
  "MIL|1960s", // Bucks — entered 1968 (best: Jon McGlocklin)
  "LAC|1990s", // Clippers — perennial cellar (best: Charles Smith)
  "PHX|2010s", // Suns — post-Nash collapse (best: Amar'e Stoudemire)
]);

/**
 * Pure roster validation against the player snapshot. The zod RosterSchema
 * (contracts) handles shape; this enforces the game rules:
 *   - all five positions have a starter
 *   - an allowed number of bench players (default BENCH_COUNT; 10-player mode
 *     passes its larger bench via benchCounts)
 *   - every id exists in the snapshot
 *   - no player (playerSlug) appears twice
 */

import {
  BENCH_COUNT,
  PlayerStatLine,
  POSITIONS,
  Roster,
} from "@/lib/contracts";

export type RosterValidation =
  | { ok: true; playerIds: string[] }
  | { ok: false; error: string };

export function validateRoster(
  roster: Roster,
  players: Map<string, PlayerStatLine>,
  options: { benchCounts?: readonly number[] } = {}
): RosterValidation {
  const benchCounts = options.benchCounts ?? [BENCH_COUNT];
  const missing = POSITIONS.filter((pos) => !roster.starters[pos]);
  if (missing.length > 0) {
    return { ok: false, error: `Missing starter at ${missing.join(", ")}` };
  }

  if (!benchCounts.includes(roster.bench.length)) {
    const expected =
      benchCounts.length === 1 ? `exactly ${benchCounts[0]}` : benchCounts.join(" or ");
    return {
      ok: false,
      error: `Bench must have ${expected} players (got ${roster.bench.length})`,
    };
  }

  const ids = [...POSITIONS.map((pos) => roster.starters[pos]!), ...roster.bench];

  const unknown = ids.filter((id) => !players.has(id));
  if (unknown.length > 0) {
    return { ok: false, error: `Unknown player id(s): ${unknown.join(", ")}` };
  }

  if (new Set(ids).size !== ids.length) {
    return { ok: false, error: "Roster contains duplicate player entries" };
  }

  const slugs = ids.map((id) => players.get(id)!.playerSlug);
  const seen = new Set<string>();
  for (const slug of slugs) {
    if (seen.has(slug)) {
      return { ok: false, error: `Player drafted twice: ${slug}` };
    }
    seen.add(slug);
  }

  return { ok: true, playerIds: ids };
}

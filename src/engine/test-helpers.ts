/**
 * Shared roster fixtures/builders for the engine test suite. Test-only —
 * not exported from the engine entry point.
 */

import {
  DECADES,
  EXCLUDED_DECADES_PER_GAME,
  Position,
  POSITIONS,
  Roster,
} from "@/lib/contracts";
import { getBaselines, getPlayerMap, getSnapshot } from "@/lib/snapshot";
import { mulberry32 } from "./rng";

// Tests run against the production snapshot (public/data/snapshot-v1.json):
// the engine's tuning only means anything on real data. Regenerating the ETL
// snapshot is a deliberate re-baselining event for the golden masters below.
export const players = getPlayerMap();
export const baselines = getBaselines();

export function roster(starters: Record<Position, string>, bench: string[]): Roster {
  for (const id of [...Object.values(starters), ...bench]) {
    if (!players.has(id)) throw new Error(`Unknown fixture player id: ${id}`);
  }
  return { starters, bench };
}

/** All-time great roster, everyone at a natural position. */
export const ALL_TIME = roster(
  {
    PG: "johnsma02-LAL-1980s", // Magic Johnson
    SG: "jordami01-CHI-1990s", // Michael Jordan
    SF: "birdla01-BOS-1980s", // Larry Bird
    PF: "duncati01-SAS-2000s", // Tim Duncan
    C: "chambwi01-GSW-1960s", // Wilt Chamberlain
  },
  [
    "curryst01-GSW-2010s", // Stephen Curry
    "olajuha01-HOU-1990s", // Hakeem Olajuwon
    "jokicni01-DEN-2020s", // Nikola Jokić
  ]
);

/** Balanced-but-unspectacular (by this pool's standards): good two-way
 *  players, no transcendent anchor. */
export const BALANCED = roster(
  {
    PG: "fraziwa01-NYK-1970s", // Walt Frazier
    SG: "wadedw01-MIA-2000s", // Dwyane Wade
    SF: "leonaka01-SAS-2010s", // Kawhi Leonard
    PF: "malonka01-UTA-1990s", // Karl Malone
    C: "reedwi01-NYK-1970s", // Willis Reed
  },
  [
    "ervinju01-PHI-1970s", // Julius Erving
    "tatumja01-BOS-2020s", // Jayson Tatum
    "nashst01-PHX-2000s", // Steve Nash
  ]
);

/** Glaring hole: five centers (poor free-throw shooters) crammed into the
 *  lineup, several wildly out of position. */
export const ALL_CENTERS = roster(
  {
    PG: "onealsh01-LAL-2000s", // Shaquille O'Neal at point guard
    SG: "malonmo01-PHI-1980s", // Moses Malone
    SF: "thurmna01-GSW-1960s", // Nate Thurmond
    PF: "russebi01-BOS-1960s", // Bill Russell
    C: "chambwi01-GSW-1960s", // Wilt Chamberlain
  },
  [
    "reedwi01-NYK-1970s", // Willis Reed
    "abdulka01-LAL-1980s", // Kareem Abdul-Jabbar
    "embiijo01-PHI-2020s", // Joel Embiid
  ]
);

/** Turnover-machine roster: high-usage, high-tov stars. */
export const TURNOVER_PRONE = roster(
  {
    PG: "westbru01-OKC-2010s", // Russell Westbrook
    SG: "hardeja01-HOU-2010s", // James Harden
    SF: "doncilu01-DAL-2020s", // Luka Dončić (alt SF)
    PF: "antetgi01-MIL-2020s", // Giannis Antetokounmpo
    C: "jokicni01-DEN-2020s", // Nikola Jokić
  },
  [
    "nashst01-PHX-2000s", // Steve Nash
    "johnsma02-LAL-1980s", // Magic Johnson
    "curryst01-GSW-2010s", // Stephen Curry
  ]
);

/** Deterministically sample a random valid 8-man roster from the fixture
 *  pool: 8 distinct players, first 5 dealt to PG..C in order, rest bench. */
export function randomRoster(rand: () => number): Roster {
  const ids = [...players.keys()];
  // Partial Fisher–Yates: deal 8 distinct ids.
  for (let i = 0; i < 8; i++) {
    const j = i + Math.floor(rand() * (ids.length - i));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const starters = {} as Record<Position, string>;
  POSITIONS.forEach((pos, i) => (starters[pos] = ids[i]));
  return { starters, bench: ids.slice(5, 8) };
}

export function randomRosters(seed: number, count: number): Roster[] {
  const rand = mulberry32(seed);
  return Array.from({ length: count }, () => randomRoster(rand));
}

/**
 * Simulate a realistic DRAFT (the engine's reference population): random
 * franchise×decade spins with 2 excluded decades, picker takes one of the
 * top 3 pool players by playerScore, starters assigned natural-position-first.
 * Mirrors scripts/etl/dist-check.ts.
 */
export function draftedRosters(
  seed: number,
  count: number,
  score: (id: string) => number
): Roster[] {
  const snapshot = getSnapshot();
  const combos: [string, Position | string][] = [];
  for (const [f, decs] of Object.entries(snapshot.pools))
    for (const [d, ids] of Object.entries(decs)) if (ids.length) combos.push([f, d]);
  const rand = mulberry32(seed);
  const cache = new Map<string, number>();
  const sc = (id: string) => {
    if (!cache.has(id)) cache.set(id, score(id));
    return cache.get(id)!;
  };

  return Array.from({ length: count }, () => {
    const excluded = new Set<string>();
    while (excluded.size < EXCLUDED_DECADES_PER_GAME)
      excluded.add(DECADES[Math.floor(rand() * DECADES.length)]);
    const picked: string[] = [];
    const slugs = new Set<string>();
    while (picked.length < 8) {
      const [f, d] = combos[Math.floor(rand() * combos.length)];
      if (excluded.has(d as string)) continue;
      const pool = snapshot.pools[f][d as string].filter(
        (id) => !slugs.has(players.get(id)!.playerSlug)
      );
      if (!pool.length) continue;
      const top = [...pool].sort((a, b) => sc(b) - sc(a)).slice(0, 3);
      const id = top[Math.floor(rand() * top.length)];
      picked.push(id);
      slugs.add(players.get(id)!.playerSlug);
    }
    const sorted = [...picked].sort((a, b) => sc(b) - sc(a));
    const starters = {} as Record<Position, string>;
    const used = new Set<string>();
    for (const id of sorted) {
      if (Object.keys(starters).length === 5) break;
      const p = players.get(id)!;
      const prefs = [p.position, ...p.altPositions, ...POSITIONS];
      const slot = prefs.find((pos) => !(pos in starters));
      if (slot) {
        starters[slot] = id;
        used.add(id);
      }
    }
    return { starters, bench: picked.filter((id) => !used.has(id)).slice(0, 3) };
  });
}

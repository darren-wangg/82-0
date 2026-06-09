/**
 * Naive placeholder implementation of the Engine contract so Wave 1C (UI) and
 * Wave 1D (backend) can build and demo against realistic-feeling numbers.
 * Replaced by src/engine (Wave 1B) at integration via engine-provider.
 */

import {
  AdjustedStats,
  BENCH_WEIGHT,
  CatEdge,
  Engine,
  EraBaselines,
  MatchupResult,
  NEGATIVE_CATS,
  NINE_CATS,
  NineCat,
  OVR_MAX,
  PlayerStatLine,
  Roster,
  SEASON_GAMES,
  SeasonResult,
  TeamRating,
} from "./contracts";

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const mockEngine: Engine = {
  eraAdjust(p: PlayerStatLine, baselines: EraBaselines): AdjustedStats {
    const b = baselines[p.decade];
    const out = {} as AdjustedStats;
    for (const cat of NINE_CATS) {
      const z = (p.stats[cat] - b.mean[cat]) / (b.sd[cat] || 1);
      out[cat] = NEGATIVE_CATS.includes(cat) ? -z : z;
    }
    out.ortg = (p.ortg - b.mean.ortg) / (b.sd.ortg || 1);
    out.drtg = -((p.drtg - b.mean.drtg) / (b.sd.drtg || 1));
    return out;
  },

  playerScore(adj: AdjustedStats): number {
    const cats = NINE_CATS.map((c) => adj[c]);
    return (
      cats.reduce((s, v) => s + v, 0) / cats.length + 0.25 * (adj.ortg + adj.drtg)
    );
  },

  teamRating(roster: Roster, players, baselines): TeamRating {
    const starterIds = Object.values(roster.starters);
    const entries = [
      ...starterIds.map((id) => ({ id, w: 1 })),
      ...roster.bench.map((id) => ({ id, w: BENCH_WEIGHT })),
    ];
    const catProfile = Object.fromEntries(NINE_CATS.map((c) => [c, 0])) as Record<
      NineCat,
      number
    >;
    let off = 0;
    let def = 0;
    let totalW = 0;
    for (const { id, w } of entries) {
      const p = players.get(id);
      if (!p) continue;
      const adj = mockEngine.eraAdjust(p, baselines);
      for (const c of NINE_CATS) catProfile[c] += adj[c] * w;
      off += (adj.ortg + adj.pts + adj.ast) * w;
      def += (adj.drtg + adj.stl + adj.blk + adj.reb) * w;
      totalW += w;
    }
    const sum = NINE_CATS.reduce((s, c) => s + catProfile[c], 0);
    const clamp = (v: number) => Math.max(0, Math.min(100, v));
    return {
      ovr: Math.max(0, Math.min(OVR_MAX, 55 + sum * 4)),
      offRating: clamp(50 + (off / Math.max(totalW, 1)) * 10),
      defRating: clamp(50 + (def / Math.max(totalW, 1)) * 8),
      catProfile,
    };
  },

  projectSeason(rating: TeamRating): SeasonResult {
    let gatedCategory: NineCat | null = null;
    let winCap = SEASON_GAMES;
    for (const c of NINE_CATS) {
      const cap = rating.catProfile[c] < -1.5 ? 60 : SEASON_GAMES;
      if (cap < winCap) {
        winCap = cap;
        gatedCategory = c;
      }
    }
    const raw = Math.round(
      SEASON_GAMES * Math.pow(rating.ovr / OVR_MAX, 1.6)
    );
    const wins = Math.max(0, Math.min(winCap, raw));
    return { wins, losses: SEASON_GAMES - wins, ovr: rating.ovr, gatedCategory, winCap };
  },

  simulateMatchup(a: TeamRating, b: TeamRating, seed: number): MatchupResult {
    const rand = mulberry32(seed);
    const pGameA = 1 / (1 + Math.exp(-(a.ovr - b.ovr) / 6));
    let aWins = 0;
    let bWins = 0;
    while (aWins < 4 && bWins < 4) {
      if (rand() < pGameA) aWins++;
      else bWins++;
    }
    const catBreakdown: CatEdge[] = NINE_CATS.map((cat) => ({
      cat,
      teamA: a.catProfile[cat],
      teamB: b.catProfile[cat],
      edge: a.catProfile[cat] - b.catProfile[cat],
    }));
    return {
      winner: aWins > bWins ? "A" : "B",
      seriesScore: [aWins, bWins],
      pGameA,
      catBreakdown,
      seed,
    };
  },
};

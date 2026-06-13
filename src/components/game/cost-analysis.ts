/**
 * Post-season "what cost you" analysis. Pure logic over engine outputs:
 *  - gated season → how many wins the gate ate and which rostered player is
 *    the biggest culprit in the gated category (worst era-adjusted z),
 *  - ungated-but-imperfect season → the weakest player by playerScore, with
 *    an out-of-position note when their slot doesn't fit their positions.
 *    Starters only by default; pass considerBench (10-player mode) to let a
 *    weak bench player be named as the weakest link too.
 * A perfect season returns null — nothing cost you anything.
 */

import {
  EraBaselines,
  NINE_CATS,
  NineCat,
  PlayerStatLine,
  Position,
  POSITIONS,
  Roster,
  SEASON_GAMES,
  SeasonResult,
  TeamRating,
} from "@/lib/contracts";
import { getEngine } from "@/lib/engine-provider";
import { slotAccepts } from "./draft-state";

export type CostAnalysis =
  | {
      kind: "gated";
      cat: NineCat;
      winCap: number;
      /** Wins the gate ate relative to the team's ungated win curve. */
      winsLost: number;
      /** Worst era-adjusted z in the gated category across the roster. */
      culprit: { player: PlayerStatLine; z: number };
    }
  | {
      kind: "weakest";
      slot: Position;
      player: PlayerStatLine;
      outOfPosition: boolean;
      /** True when the weakest link is a bench player (10-player mode). */
      bench: boolean;
    };

/** Every cat comfortably above its gate threshold, so projecting a season
 *  with this profile recovers the pure (ungated) win curve from the engine
 *  itself — no curve constants duplicated here. */
const UNGATED_PROFILE = Object.fromEntries(
  NINE_CATS.map((cat) => [cat, 3])
) as Record<NineCat, number>;

export function analyzeCost(
  roster: Roster,
  rating: TeamRating,
  season: SeasonResult,
  players: Map<string, PlayerStatLine>,
  baselines: EraBaselines,
  options: { considerBench?: boolean } = {}
): CostAnalysis | null {
  if (season.wins >= SEASON_GAMES) return null;
  const engine = getEngine();

  if (season.gatedCategory) {
    const cat = season.gatedCategory;
    const ids = [...Object.values(roster.starters), ...roster.bench];
    let culprit: { player: PlayerStatLine; z: number } | null = null;
    for (const id of ids) {
      const player = players.get(id);
      if (!player) continue;
      const z = engine.eraAdjust(player, baselines)[cat];
      if (!culprit || z < culprit.z) culprit = { player, z };
    }
    if (!culprit) return null;
    const curveWins = engine.projectSeason({
      ...rating,
      catProfile: UNGATED_PROFILE,
    }).wins;
    return {
      kind: "gated",
      cat,
      winCap: season.winCap,
      winsLost: Math.max(0, curveWins - season.wins),
      culprit,
    };
  }

  let weakest: {
    slot: Position;
    player: PlayerStatLine;
    score: number;
    bench: boolean;
  } | null = null;
  const consider = (slot: Position, player: PlayerStatLine, bench: boolean) => {
    const score = engine.playerScore(engine.eraAdjust(player, baselines));
    if (!weakest || score < weakest.score) weakest = { slot, player, score, bench };
  };
  for (const slot of POSITIONS) {
    const id = roster.starters[slot];
    const player = id ? players.get(id) : undefined;
    if (player) consider(slot, player, false);
  }
  // 10-player mode: a weak bench player can be the weakest link. Bench slots
  // are positional and players always fit them, so a bench player is reported
  // at their own primary position (never out of position).
  if (options.considerBench) {
    for (const id of roster.bench) {
      const player = players.get(id);
      if (player) consider(player.position, player, true);
    }
  }
  if (!weakest) return null;
  const w: { slot: Position; player: PlayerStatLine; score: number; bench: boolean } =
    weakest;
  return {
    kind: "weakest",
    slot: w.slot,
    player: w.player,
    bench: w.bench,
    outOfPosition:
      !w.bench &&
      !slotAccepts(w.slot, [w.player.position, ...w.player.altPositions]),
  };
}

/**
 * Estimation heuristics for stats that were not recorded in early eras.
 *
 * NBA recording history (the dataset mirrors Basketball-Reference):
 * - STL/BLK: first recorded 1973-74 (ABA: 1972-73)
 * - TOV:     first recorded 1977-78 (ABA: from 1967-68)
 * - 3PM:     NBA line introduced 1979-80 (ABA had it from the start)
 * - Individual DRtg: from 1973-74; individual ORtg: from 1977-78 (needs TOV)
 *
 * Every estimate is flagged in `estimatedCats` so the UI can mark it "est.".
 * All formulas are documented in scripts/etl/README.md.
 */

import type { Position } from "../../src/lib/contracts";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Position-profile steal rates per 36 minutes (calibrated to mid-70s league data). */
export const STL_PER36: Record<Position, number> = {
  PG: 1.7,
  SG: 1.5,
  SF: 1.3,
  PF: 1.0,
  C: 0.9,
};

/** Position-profile block rates per 36 minutes (scaled by rebounding below). */
export const BLK_PER36: Record<Position, number> = {
  PG: 0.2,
  SG: 0.3,
  SF: 0.5,
  PF: 1.1,
  C: 1.9,
};

/** stl_est = STL_PER36[pos] x mp/36 */
export function estimateStl(pos: Position, mpPerGame: number): number {
  return STL_PER36[pos] * (mpPerGame / 36);
}

/**
 * blk_est = BLK_PER36[pos] x mp/36 x clamp(reb/10, 0.6, 1.8)
 * The rebound multiplier separates true rim protectors (Russell, Wilt,
 * Thurmond) from low-rebound bigs at the same listed position.
 */
export function estimateBlk(pos: Position, mpPerGame: number, rebPerGame: number): number {
  return BLK_PER36[pos] * (mpPerGame / 36) * clamp(rebPerGame / 10, 0.6, 1.8);
}

/**
 * tov_est = 0.075 x (FGA + 0.44 x FTA) + 0.18 x AST
 * i.e. ~7.5% of true shooting possessions plus an assist-volume term —
 * matches observed turnover rates of high-usage players once TOV was tracked.
 */
export function estimateTov(fgaPerGame: number, ftaPerGame: number, astPerGame: number): number {
  return 0.075 * (fgaPerGame + 0.44 * ftaPerGame) + 0.18 * astPerGame;
}

/**
 * ortg_est = lgORtg x (1 + 0.75 x (TS/lgTS - 1)) + 0.5 x AST,
 * clamped to [lgORtg - 10, lgORtg + 18].
 * Scoring efficiency relative to the league anchors the rating; assists add
 * a small creation bonus. lgORtg/lgTS come from the season's Team Summaries
 * "League Average" row, so era scoring context is built in.
 */
export function estimateOrtg(
  lgOrtg: number,
  lgTs: number,
  ts: number,
  astPerGame: number
): number {
  const eff = lgOrtg * (1 + 0.75 * (ts / lgTs - 1)) + 0.5 * astPerGame;
  return clamp(eff, lgOrtg - 10, lgOrtg + 18);
}

/**
 * drtg_est = lgORtg - 0.15 x REB - 0.8 x STL - 0.8 x BLK,
 * clamped to [lgORtg - 12, lgORtg + 6].
 * (League average DRtg equals league average ORtg by definition; defensive
 * event volume pulls a player below it.)
 */
export function estimateDrtg(
  lgOrtg: number,
  rebPerGame: number,
  stlPerGame: number,
  blkPerGame: number
): number {
  const d = lgOrtg - 0.15 * rebPerGame - 0.8 * stlPerGame - 0.8 * blkPerGame;
  return clamp(d, lgOrtg - 12, lgOrtg + 6);
}

/** True shooting from per-game counting stats. */
export function trueShooting(pts: number, fga: number, fta: number): number {
  const denom = 2 * (fga + 0.44 * fta);
  return denom > 0 ? pts / denom : 0;
}

/** Fallback when the dataset lists position "NA" (193 rows since 1960). */
export function inferPosition(astPerGame: number, rebPerGame: number): Position {
  if (rebPerGame >= 10) return "C";
  if (rebPerGame >= 7.5) return "PF";
  if (astPerGame >= 5) return "PG";
  if (astPerGame >= 3) return "SG";
  return "SF";
}

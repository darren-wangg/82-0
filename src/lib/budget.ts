/**
 * Budget Matchups — difficulty definitions and cap constants.
 * These are the only budget types that are NOT in contracts.ts (which is frozen).
 *
 * Roster size is no longer budget-specific: budget drafts follow the global
 * 5 / 8 / 10 team-size preference (ud:team-size cookie, src/lib/team-size.ts),
 * the same toggle that drives the classic modes.
 */

import { DEFAULT_TEAM_SIZE, type TeamSize } from "./team-size";

export const BUDGET_DIFFICULTIES = ["easy", "normal", "hard"] as const;
export type BudgetDifficulty = (typeof BUDGET_DIFFICULTIES)[number];

/**
 * Salary cap in $, per roster size then difficulty. Caps scale linearly with
 * roster size (~$22.5 / $17.5 / $12.5 per extra slot by tier, snapped to $5)
 * so the same star-vs-depth tradeoffs carry over at every size.
 */
export const BUDGET_CAP: Record<TeamSize, Record<BudgetDifficulty, number>> = {
  5: { easy: 110, normal: 85, hard: 65 },
  8: { easy: 175, normal: 135, hard: 100 },
  10: { easy: 220, normal: 170, hard: 125 },
};

/** Cap for a given size + difficulty (unknown sizes fall back to 8-man caps). */
export function budgetCap(size: number, difficulty: BudgetDifficulty): number {
  const tier = BUDGET_CAP[(size in BUDGET_CAP ? size : DEFAULT_TEAM_SIZE) as TeamSize];
  return tier[difficulty];
}

export function isBudgetDifficulty(value: unknown): value is BudgetDifficulty {
  return BUDGET_DIFFICULTIES.includes(value as BudgetDifficulty);
}

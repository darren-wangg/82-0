/**
 * Budget Matchups — difficulty definitions and cap constants.
 * These are the only budget types that are NOT in contracts.ts (which is frozen).
 */

export const BUDGET_DIFFICULTIES = ["easy", "normal", "hard"] as const;
export type BudgetDifficulty = (typeof BUDGET_DIFFICULTIES)[number];

/** Salary cap per difficulty, in $. */
export const BUDGET_CAP: Record<BudgetDifficulty, number> = {
  easy: 130,
  normal: 100,
  hard: 75,
};

export function isBudgetDifficulty(value: unknown): value is BudgetDifficulty {
  return BUDGET_DIFFICULTIES.includes(value as BudgetDifficulty);
}

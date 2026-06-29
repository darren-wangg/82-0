/**
 * Budget Matchups — difficulty + roster-size definitions and cap constants.
 * These are the only budget types that are NOT in contracts.ts (which is frozen).
 */

export const BUDGET_DIFFICULTIES = ["easy", "normal", "hard"] as const;
export type BudgetDifficulty = (typeof BUDGET_DIFFICULTIES)[number];

/** Budget rosters come in two sizes: 6 (5 starters + 1 bench) or 8 (5 + 3). */
export const BUDGET_SIZES = [6, 8] as const;
export type BudgetSize = (typeof BUDGET_SIZES)[number];

/** Default roster size for a fresh budget run (the original mode). */
export const DEFAULT_BUDGET_SIZE: BudgetSize = 6;

/** Session cookie (no Max-Age → cleared when the browser session ends). Kept
 *  separate from the classic 5/8/10 team-size cookie since the value sets
 *  differ (budget is 6/8). */
export const BUDGET_SIZE_COOKIE = "ud:budget-size";

/**
 * Salary cap in $, per roster size then difficulty. The 8-man caps are bumped
 * ~⅓ over the 6-man caps to pay for the two extra roster spots, so the same
 * star-vs-depth tradeoffs carry over at the larger size.
 */
export const BUDGET_CAP: Record<BudgetSize, Record<BudgetDifficulty, number>> = {
  6: { easy: 130, normal: 100, hard: 75 },
  8: { easy: 175, normal: 135, hard: 100 },
};

/** Cap for a given size + difficulty (size falls back to the 6-man caps). */
export function budgetCap(size: number, difficulty: BudgetDifficulty): number {
  const tier = BUDGET_CAP[size === 8 ? 8 : 6];
  return tier[difficulty];
}

export function isBudgetDifficulty(value: unknown): value is BudgetDifficulty {
  return BUDGET_DIFFICULTIES.includes(value as BudgetDifficulty);
}

export function isBudgetSize(value: unknown): value is BudgetSize {
  return (BUDGET_SIZES as readonly number[]).includes(Number(value));
}

/** Coerce an unknown (cookie/param) into a valid budget size. */
export function resolveBudgetSize(raw: unknown): BudgetSize {
  const n = Number(raw);
  return (BUDGET_SIZES as readonly number[]).includes(n)
    ? (n as BudgetSize)
    : DEFAULT_BUDGET_SIZE;
}

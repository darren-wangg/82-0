"use client";

/**
 * Client-side budget context: holds the salary cap, price map, and tracks
 * the current spend. Consumed by the budget-aware pool list and draft meter.
 *
 * The price map is derived from the snapshot (fetched by GameProvider); it is
 * passed down from the BudgetPlayScreen once the snapshot lands.
 */

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import type { BudgetDifficulty } from "@/lib/budget";
import { BUDGET_CAP } from "@/lib/budget";

export interface BudgetContextValue {
  /** Salary cap for this game (e.g. 100 for Normal). */
  cap: number;
  /** Difficulty label. */
  difficulty: BudgetDifficulty;
  /** playerId → price ($5–$50). Null until snapshot loads. */
  priceMap: Map<string, number> | null;
  /** Sum of prices of all currently placed players. */
  spent: number;
  /** Remaining budget. */
  remaining: number;
}

const BudgetContext = createContext<BudgetContextValue | null>(null);

export function BudgetProvider({
  children,
  difficulty,
  priceMap,
  spent,
}: {
  children: ReactNode;
  difficulty: BudgetDifficulty;
  priceMap: Map<string, number> | null;
  spent: number;
}) {
  const cap = BUDGET_CAP[difficulty];
  return (
    <BudgetContext.Provider
      value={{ cap, difficulty, priceMap, spent, remaining: cap - spent }}
    >
      {children}
    </BudgetContext.Provider>
  );
}

export function useBudget(): BudgetContextValue {
  const ctx = useContext(BudgetContext);
  if (!ctx) {
    throw new Error("useBudget must be used inside a BudgetProvider");
  }
  return ctx;
}

/** useBudget but returns null outside a BudgetProvider (for shared components). */
export function useBudgetOptional(): BudgetContextValue | null {
  return useContext(BudgetContext);
}

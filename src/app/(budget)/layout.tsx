import type { ReactNode } from "react";
import { GameProvider } from "@/components/game/game-provider";
import { BUDGET_MODE } from "@/components/game/draft-state";

/**
 * Budget mode: same 8-man roster as classic, routes to /budget/play and
 * /budget/sim. Independent GameProvider instance with its own localStorage key
 * so a budget draft never clobbers a classic game.
 */
export default function BudgetGameLayout({ children }: { children: ReactNode }) {
  return (
    <div className="dark flex min-h-dvh flex-1 flex-col bg-background text-foreground">
      <GameProvider mode={BUDGET_MODE}>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
          {children}
        </div>
      </GameProvider>
    </div>
  );
}

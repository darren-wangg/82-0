import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { GameProvider } from "@/components/game/game-provider";
import { BUDGET8_MODE, BUDGET_MODE } from "@/components/game/draft-state";
import { BUDGET_SIZE_COOKIE, resolveBudgetSize } from "@/lib/budget";

/**
 * Budget mode: routes to /budget/play and /budget/sim. The roster size (6 or 8)
 * is chosen on the /budget selector and stored in a session cookie, so this
 * layout mounts the matching GameProvider mode — each size has its own
 * localStorage key, so a 6-man draft never clobbers an 8-man one (or vice
 * versa). Cap and famous opponents are size-aware downstream.
 */
export default async function BudgetGameLayout({
  children,
}: {
  children: ReactNode;
}) {
  const size = resolveBudgetSize(
    (await cookies()).get(BUDGET_SIZE_COOKIE)?.value
  );
  const mode = size === 8 ? BUDGET8_MODE : BUDGET_MODE;
  return (
    <div className="dark flex min-h-dvh flex-1 flex-col bg-background text-foreground">
      <GameProvider mode={mode}>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
          {children}
        </div>
      </GameProvider>
    </div>
  );
}

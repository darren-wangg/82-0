import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { GameProvider } from "@/components/game/game-provider";
import { budgetModeForSize } from "@/components/game/draft-state";
import { resolveTeamSize, TEAM_SIZE_COOKIE } from "@/lib/team-size";

/**
 * Budget mode: routes to /budget/play and /budget/sim. The roster size follows
 * the global 5 / 8 / 10 team-size preference (same cookie as the home-page
 * toggle), so this layout mounts the matching GameProvider mode — each size
 * has its own localStorage key, so drafts at different sizes never clobber
 * each other. Cap and famous opponents are size-aware downstream.
 */
export default async function BudgetGameLayout({
  children,
}: {
  children: ReactNode;
}) {
  const size = resolveTeamSize(
    (await cookies()).get(TEAM_SIZE_COOKIE)?.value
  );
  const mode = budgetModeForSize(size);
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

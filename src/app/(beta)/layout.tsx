import type { ReactNode } from "react";
import { GameProvider } from "@/components/game/game-provider";
import { TEN_MODE } from "@/components/game/draft-state";

/**
 * 10-player beta. A second, independent GameProvider instance — its own mode
 * (5 starters + a PG/SG/SF/PF/C bench, 10 rounds, 2 team + 2 era skips) and
 * its own localStorage key — so a beta draft never touches the live game.
 */
export default function BetaGameLayout({ children }: { children: ReactNode }) {
  return (
    <div className="dark flex min-h-dvh flex-1 flex-col bg-background text-foreground">
      <GameProvider mode={TEN_MODE}>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
          {children}
        </div>
      </GameProvider>
    </div>
  );
}

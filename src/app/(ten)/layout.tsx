import type { ReactNode } from "react";
import { GameProvider } from "@/components/game/game-provider";
import { TEN_MODE } from "@/components/game/draft-state";
import { preloadGameData } from "@/lib/preload-game-data";

/**
 * 10-man mode: five starters + a PG/SG/SF/PF/C bench (10 rounds, 2 team + 2 era
 * skips). An independent GameProvider instance with its own mode and
 * localStorage key, so a 10-man draft never touches the other games.
 */
export default function TenGameLayout({ children }: { children: ReactNode }) {
  // Deep links skip the home page's preload — warm the data here too.
  preloadGameData();
  return (
    <div className="dark flex min-h-svh flex-1 flex-col bg-background text-foreground">
      <GameProvider mode={TEN_MODE}>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
          {children}
        </div>
      </GameProvider>
    </div>
  );
}

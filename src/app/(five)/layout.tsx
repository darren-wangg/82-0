import type { ReactNode } from "react";
import { GameProvider } from "@/components/game/game-provider";
import { FIVE_MODE } from "@/components/game/draft-state";
import { preloadGameData } from "@/lib/preload-game-data";

/**
 * 5-man mode: five starters, no bench. An independent GameProvider instance
 * with its own mode (5 rounds) and localStorage key, so a 5-man draft never
 * touches the classic or 10-player games.
 */
export default function FiveGameLayout({ children }: { children: ReactNode }) {
  // Deep links skip the home page's preload — warm the data here too.
  preloadGameData();
  return (
    <div className="dark flex min-h-svh flex-1 flex-col bg-background text-foreground">
      <GameProvider mode={FIVE_MODE}>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
          {children}
        </div>
      </GameProvider>
    </div>
  );
}

import type { ReactNode } from "react";
import { GameProvider } from "@/components/game/game-provider";
import { preloadGameData } from "@/lib/preload-game-data";

export default function GameLayout({ children }: { children: ReactNode }) {
  // Deep links (shared /play URLs, bookmarks) skip the home page's preload.
  preloadGameData();
  return (
    <div className="dark flex min-h-svh flex-1 flex-col bg-background text-foreground">
      <GameProvider>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
          {children}
        </div>
      </GameProvider>
    </div>
  );
}

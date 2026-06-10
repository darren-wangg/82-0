import type { ReactNode } from "react";
import Link from "next/link";
import { GameProvider } from "@/components/game/game-provider";

export default function GameLayout({ children }: { children: ReactNode }) {
  return (
    <div className="dark flex min-h-dvh flex-1 flex-col bg-background text-foreground">
      <GameProvider>
        <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
          <div className="mx-auto flex h-12 w-full max-w-md items-center justify-between px-4">
            <Link
              href="/"
              className="font-mono text-lg font-black tracking-tighter tabular-nums"
            >
              82-0
            </Link>
            <span className="text-[10px] font-semibold tracking-[0.25em] text-muted-foreground uppercase">
              Draft the perfect season
            </span>
          </div>
        </header>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
          {children}
        </div>
      </GameProvider>
    </div>
  );
}

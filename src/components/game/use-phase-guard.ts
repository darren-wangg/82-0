"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CLASSIC_MODE, type GameStatus } from "./draft-state";
import { useGame } from "./game-provider";

/**
 * Redirects to the route that matches the game's current phase when this
 * screen isn't it (e.g. landing on /sim with an unfinished draft). Routes are
 * mode-aware, so the 10-player beta bounces between /play10 and /sim10.
 * Returns true while the screen is allowed to render.
 */
export function usePhaseGuard(allowed: GameStatus[]): boolean {
  const { state, ctx } = useGame();
  const router = useRouter();
  const ok = state === null || allowed.includes(state.status);
  const mode = ctx.mode ?? CLASSIC_MODE;

  useEffect(() => {
    if (state && !ok) {
      router.replace(state.status === "draft" ? mode.playPath : mode.simPath);
    }
  }, [state, ok, router, mode.playPath, mode.simPath]);

  return ok;
}

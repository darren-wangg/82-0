"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { GameStatus } from "./draft-state";
import { useGame } from "./game-provider";

const ROUTE_FOR_STATUS: Record<GameStatus, string> = {
  draft: "/play",
  locked: "/sim",
};

/**
 * Redirects to the route that matches the game's current phase when this
 * screen isn't it (e.g. landing on /sim with an unfinished draft). Returns
 * true while the screen is allowed to render.
 */
export function usePhaseGuard(allowed: GameStatus[]): boolean {
  const { state } = useGame();
  const router = useRouter();
  const ok = state === null || allowed.includes(state.status);

  useEffect(() => {
    if (state && !ok) router.replace(ROUTE_FOR_STATUS[state.status]);
  }, [state, ok, router]);

  return ok;
}

"use client";

/**
 * Client-side game store: wraps the pure reducer with localStorage
 * persistence and snapshot-derived lookups. State is null until the first
 * client effect restores (or creates) a game, avoiding hydration mismatches.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Franchise, PlayerStatLine, Snapshot } from "@/lib/contracts";
import { getPlayerMap, loadSnapshot } from "@/lib/snapshot-client";
import { loadHeadshotFallbacks } from "@/lib/headshots-client";
import {
  buildDraftContext,
  deserializeGame,
  gameReducer,
  newGame,
  serializeGame,
  STORAGE_KEY,
  type DraftContext,
  type GameAction,
  type GameState,
} from "./draft-state";

interface GameStore {
  /** null until restored from localStorage on the client. */
  state: GameState | null;
  dispatch: (action: GameAction) => void;
  ctx: DraftContext;
  players: Map<string, PlayerStatLine>;
  franchiseById: Map<string, Franchise>;
}

const GameContext = createContext<GameStore | null>(null);

export function freshSeed(): number {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

/** Pre-game shell while the snapshot downloads (or after it fails). */
function SnapshotGate({ error, retry }: { error: boolean; retry: () => void }) {
  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-muted-foreground">
          Couldn&apos;t load the player data — check your connection.
        </p>
        <Button variant="outline" onClick={retry}>
          Try again
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-1 flex-col gap-3 px-4 py-6">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-2 w-full" />
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="mt-auto h-14 w-full rounded-2xl" />
    </div>
  );
}

export function GameProvider({ children }: { children: ReactNode }) {
  // The snapshot is fetched from /data (not bundled); the game renders a
  // shell until it lands. The headshot fallback map loads alongside it.
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadSnapshot(), loadHeadshotFallbacks()])
      .then(([snap]) => {
        if (!cancelled) setSnapshot(snap);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const derived = useMemo(() => {
    if (!snapshot) return null;
    return {
      ctx: buildDraftContext(snapshot),
      players: getPlayerMap(snapshot),
      franchiseById: new Map(snapshot.franchises.map((f) => [f.id, f])),
    };
  }, [snapshot]);
  const ctx = derived?.ctx ?? null;

  const [state, setState] = useState<GameState | null>(null);

  // Restore (or create) the game once the snapshot is ready — client only.
  useEffect(() => {
    if (!ctx) return;
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      // storage unavailable (private mode etc.) — play in memory
    }
    // One-time, client-only restore: rendering the stored game on the server
    // (or in the first client render) would cause a hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(deserializeGame(stored, ctx) ?? newGame(freshSeed(), ctx));
  }, [ctx]);

  // Persist on every change.
  useEffect(() => {
    if (!state) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, serializeGame(state));
    } catch {
      // best-effort persistence only
    }
  }, [state]);

  const dispatch = useCallback(
    (action: GameAction) =>
      setState((s) => (s && ctx ? gameReducer(s, action, ctx) : s)),
    [ctx]
  );

  const value = useMemo<GameStore | null>(
    () => (derived ? { state, dispatch, ...derived } : null),
    [state, dispatch, derived]
  );

  if (!value) {
    return (
      <SnapshotGate error={loadError} retry={() => {
        setLoadError(false);
        setAttempt((n) => n + 1);
      }} />
    );
  }

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameStore {
  const store = useContext(GameContext);
  if (!store) throw new Error("useGame must be used inside <GameProvider>");
  return store;
}

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
import type { Franchise, PlayerStatLine } from "@/lib/contracts";
import { getPlayerMap, getSnapshot } from "@/lib/snapshot";
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

export function GameProvider({ children }: { children: ReactNode }) {
  const { ctx, players, franchiseById } = useMemo(() => {
    const snapshot = getSnapshot();
    return {
      ctx: buildDraftContext(snapshot),
      players: getPlayerMap(snapshot),
      franchiseById: new Map(snapshot.franchises.map((f) => [f.id, f])),
    };
  }, []);

  const [state, setState] = useState<GameState | null>(null);

  // Restore (or create) the game on mount — client only.
  useEffect(() => {
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
      setState((s) => (s ? gameReducer(s, action, ctx) : s)),
    [ctx]
  );

  const value = useMemo<GameStore>(
    () => ({ state, dispatch, ctx, players, franchiseById }),
    [state, dispatch, ctx, players, franchiseById]
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameStore {
  const store = useContext(GameContext);
  if (!store) throw new Error("useGame must be used inside <GameProvider>");
  return store;
}

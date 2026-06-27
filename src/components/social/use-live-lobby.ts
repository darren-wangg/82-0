"use client";

/**
 * Polls a live lobby's compact state (~2s) for the waiting room + draft tracker.
 * Pauses while the tab is hidden, stops once the lobby reaches results. Mirrors
 * the lobby-close-notifier polling pattern, generalized for the live flow.
 */

import { useEffect, useRef, useState } from "react";
import type { LiveLobbyState } from "@/lib/live-lobby";

const POLL_MS = 2_000;

export function useLiveLobby(code: string): {
  state: LiveLobbyState | null;
  error: boolean;
} {
  const [state, setState] = useState<LiveLobbyState | null>(null);
  const [error, setError] = useState(false);
  // Latest phase, so the interval can stop itself at results without re-arming.
  const phaseRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;

    const tick = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const res = await fetch(`/api/lobbies/${encodeURIComponent(code)}/live`, {
          cache: "no-store",
        });
        if (!res.ok) {
          if (active) setError(true);
          return;
        }
        const data = (await res.json()) as LiveLobbyState;
        if (!active) return;
        setError(false);
        setState(data);
        phaseRef.current = data.phase;
        if (data.phase === "results") {
          window.clearInterval(id);
        }
      } catch {
        if (active) setError(true);
      }
    };

    void tick(); // immediate first read (no 2s skeleton flash beyond the fetch)
    const id = window.setInterval(tick, POLL_MS);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [code]);

  return { state, error };
}

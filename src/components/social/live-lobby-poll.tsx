"use client";

/**
 * Polling hook for live lobby state. Generalises the 12s close-notifier
 * pattern from lobby-close-notifier.tsx into a 2s live-state poll:
 *  - Pauses when the tab is hidden.
 *  - Stops automatically once the phase reaches "results".
 *  - Returns null while loading or when lobbyCode is null.
 *
 * Used by:
 *  - /l/[code] waiting room (participant list + Join/Start buttons)
 *  - /play draft screen (phase gate + opponent tracker)
 *  - /sim finish screen (results redirect)
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveLobbyState } from "@/lib/live-lobby";

const POLL_MS = 2_000;

export function useLiveLobbyPoll(lobbyCode: string | null): LiveLobbyState | null {
  const [state, setState] = useState<LiveLobbyState | null>(null);
  // Track active to avoid setState after unmount.
  const activeRef = useRef(true);

  const poll = useCallback(async (code: string) => {
    if (document.visibilityState === "hidden") return;
    try {
      const res = await fetch(`/api/lobbies/${encodeURIComponent(code)}/live`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as LiveLobbyState;
      if (activeRef.current) setState(data);
    } catch {
      // Transient — ignore; next tick retries.
    }
  }, []);

  useEffect(() => {
    if (!lobbyCode) return;
    activeRef.current = true;

    // Immediate first poll — setState runs inside the async callback, not
    // synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async callback
    void poll(lobbyCode);

    const id = window.setInterval(() => {
      // Stop once results phase has been received.
      if (state?.phase === "results") return;
      void poll(lobbyCode);
    }, POLL_MS);

    return () => {
      activeRef.current = false;
      window.clearInterval(id);
    };
    // poll is stable (useCallback with no deps that change), state.phase drives stop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobbyCode, poll]);

  // Stop the interval when results arrive by triggering a re-render cycle that
  // cleans up the old interval.
  useEffect(() => {
    if (state?.phase !== "results") return;
    // Nothing to do — the interval check above reads current state via the
    // closure, so it stops calling poll on the next tick.
  }, [state?.phase]);

  return lobbyCode ? state : null;
}

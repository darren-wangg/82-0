"use client";

/**
 * Background auto-refresh for an open lobby. While the lobby page is open and
 * visible, polls the lobby endpoint and re-renders the server page whenever the
 * standings change — a new team entered or the creator (or auto-close) ended
 * it. This removes the old "tap the refresh icon to check for new entries"
 * chore: the board updates on its own.
 *
 * Cost note: the poll reuses the existing GET /api/lobbies/[code] (which runs
 * the round-robin), so we keep the interval modest and pause when the tab is
 * hidden. A lightweight signature (entry count + status) gates router.refresh()
 * so we only re-render when something actually changed.
 */

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const POLL_MS = 8_000;

export function LobbyAutoRefresh({
  code,
  entrantCount,
  status,
}: {
  code: string;
  /** Entry count at last server render — the baseline we compare against. */
  entrantCount: number;
  status: "open" | "closed";
}) {
  const router = useRouter();
  // Signature of what the page is currently showing. When the polled value
  // diverges, the rendered page is stale → refresh.
  const seen = useRef(`${status}:${entrantCount}`);

  useEffect(() => {
    seen.current = `${status}:${entrantCount}`;
  }, [status, entrantCount]);

  useEffect(() => {
    if (status === "closed") return; // nothing more to watch once it's over
    let active = true;

    const tick = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const res = await fetch(`/api/lobbies/${encodeURIComponent(code)}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          status?: string;
          standings?: unknown[];
        };
        const sig = `${data.status}:${data.standings?.length ?? 0}`;
        if (active && sig !== seen.current) {
          seen.current = sig;
          router.refresh();
        }
      } catch {
        // Transient — retry next tick.
      }
    };

    const id = window.setInterval(tick, POLL_MS);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [code, status, router]);

  return null;
}

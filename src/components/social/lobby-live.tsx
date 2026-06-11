"use client";

/**
 * Pulsing "Live" badge that keeps an open lobby fresh: re-renders the server
 * page every 15s while the tab is visible (and immediately when the tab
 * regains focus), so standings update as friends enter — no refresh button.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const POLL_MS = 15_000;

export function LobbyLive() {
  const router = useRouter();

  useEffect(() => {
    const refreshIfVisible = () => {
      if (!document.hidden) router.refresh();
    };
    const t = window.setInterval(refreshIfVisible, POLL_MS);
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [router]);

  return (
    <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-400">
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
      </span>
      Live
    </span>
  );
}

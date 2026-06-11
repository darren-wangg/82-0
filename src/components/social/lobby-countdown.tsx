"use client";

/**
 * Live "closes in 23h 14m" label for an open lobby. Renders nothing until
 * mounted (the remaining time is clock-dependent, so server HTML would
 * mismatch), then ticks every 30s. Once the window lapses it prompts a
 * refresh — the server is the authority on the final standings.
 */

import { useEffect, useState } from "react";

export function LobbyCountdown({ closesAt }: { closesAt: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  if (now === null) return null;

  const ms = new Date(closesAt).getTime() - now;
  if (ms <= 0) {
    return (
      <span className="text-amber-400">
        Entries closed — refresh for the final standings
      </span>
    );
  }
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return (
    <span>
      Entries close in{" "}
      <span className="font-mono font-bold tabular-nums text-foreground">
        {hours > 0 ? `${hours}h ` : ""}
        {minutes}m
      </span>
    </span>
  );
}

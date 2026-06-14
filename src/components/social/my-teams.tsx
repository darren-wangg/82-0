"use client";

/**
 * Locally saved teams list for /teams. Reads localStorage, so it loads after
 * mount (renders nothing during SSR/hydration).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import {
  LocalTeam,
  loadLocalTeams,
  removeLocalTeam,
} from "@/components/game/local-teams";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PLAY_PATH, type TeamSize } from "@/lib/team-size";
import { cn } from "@/lib/utils";

/** Positive when `a` has the better record: wins, then losses, then OVR. */
function compareRecords(a: LocalTeam, b: LocalTeam): number {
  return a.wins - b.wins || b.losses - a.losses || a.ovr - b.ovr;
}

/** A locally saved team's size, from its bench depth (0 = 5-man, 3 = 8, 5 = 10). */
function sizeOf(team: LocalTeam): TeamSize {
  return team.roster.bench.length === 0
    ? 5
    : team.roster.bench.length >= 5
      ? 10
      : 8;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function MyTeams({
  snapshotVersion,
  teamSize,
}: {
  snapshotVersion: string;
  teamSize: TeamSize;
}) {
  // null until mounted — localStorage is unavailable on the server.
  const [teams, setTeams] = useState<LocalTeam[] | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTeams(
      [...loadLocalTeams()].sort((a, b) => b.savedAt.localeCompare(a.savedAt))
    );
  }, []);

  if (!teams) {
    return (
      <ul className="mt-4 space-y-1.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <li key={i}>
            <Skeleton className="h-[3.25rem] w-full rounded-xl" />
          </li>
        ))}
      </ul>
    );
  }

  // Only the selected size — the switch above filters the list.
  const shown = teams.filter((t) => sizeOf(t) === teamSize);

  if (shown.length === 0) {
    return (
      <div className="mt-10 text-center text-sm text-muted-foreground">
        <p>No saved {teamSize}-man teams yet — finish a season and hit Save.</p>
        <Link
          href={PLAY_PATH[teamSize]}
          className="mt-2 inline-block font-semibold text-primary"
        >
          Start a draft →
        </Link>
      </div>
    );
  }

  const bestId = shown.reduce((a, b) => (compareRecords(b, a) > 0 ? b : a)).id;

  return (
    <ul className="mt-4 space-y-1.5">
      {shown.map((t) => (
        // Stretched-link row: the <Link> overlays the card, the delete button
        // sits above it on its own z-layer (no button-inside-anchor).
        <li
          key={t.id}
          className="relative flex items-center gap-3 rounded-xl border border-border/80 bg-card/70 px-3 py-2.5 shadow-md shadow-black/25 transition-colors hover:bg-card"
        >
          <Link
            href={`/teams/${t.id}`}
            aria-label={`View ${t.name}`}
            className="absolute inset-0 rounded-xl"
          />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-sm font-bold">{t.name}</span>
              {t.id === bestId && (
                <Badge className="h-4 shrink-0 px-1.5 text-[10px] font-bold">
                  PB
                </Badge>
              )}
            </span>
            <span className="block truncate text-[11px] text-muted-foreground">
              {formatDate(t.savedAt)}
              {t.snapshotVersion !== snapshotVersion && (
                <span className="text-amber-400/90"> · older player data</span>
              )}
            </span>
          </span>
          <span
            className={cn(
              "shrink-0 font-mono text-sm font-bold tabular-nums",
              t.losses === 0 ? "text-emerald-400" : undefined
            )}
          >
            {t.wins}-{t.losses}
          </span>
          <span className="w-12 shrink-0 text-right font-mono text-xs text-muted-foreground tabular-nums">
            {Math.round(t.ovr)} OVR
          </span>
          <button
            type="button"
            aria-label={`Delete ${t.name}`}
            onClick={() => {
              removeLocalTeam(t.id);
              setTeams((prev) => prev?.filter((x) => x.id !== t.id) ?? null);
            }}
            className="relative z-10 shrink-0 rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
          </button>
        </li>
      ))}
    </ul>
  );
}

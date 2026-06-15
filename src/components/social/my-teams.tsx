"use client";

/**
 * Locally saved teams list for /teams. Reads localStorage, so it loads after
 * mount (renders nothing during SSR/hydration).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Trash2, Trophy, Upload } from "lucide-react";
import {
  LocalTeam,
  loadLocalTeams,
  markLocalTeamSubmitted,
  removeLocalTeam,
} from "@/components/game/local-teams";
import type { SaveTeamResponse } from "@/lib/contracts";
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

export function MyTeams({
  snapshotVersion,
  teamSize,
}: {
  snapshotVersion: string;
  teamSize: TeamSize;
}) {
  const tr = useTranslations("myTeams");
  const format = useFormatter();
  const formatDate = (iso: string) =>
    format.dateTime(new Date(iso), {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  // null until mounted — localStorage is unavailable on the server.
  const [teams, setTeams] = useState<LocalTeam[] | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTeams(
      [...loadLocalTeams()].sort((a, b) => b.savedAt.localeCompare(a.savedAt))
    );
  }, []);

  // Auto-dismiss the toast.
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(id);
  }, [toast]);

  // Push a locally saved team to the public leaderboard. The server re-runs the
  // engine and mints a slug; we record it so the row links there and can't be
  // resubmitted (creating a duplicate board entry).
  const submit = async (team: LocalTeam) => {
    if (submittingId) return;
    setSubmittingId(team.id);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamName: team.name,
          roster: team.roster,
          snapshotVersion: team.snapshotVersion,
        }),
      });
      if (res.status === 409) {
        setToast(tr("staleCantSubmit"));
        return;
      }
      if (res.status === 422) {
        setToast(tr("nameRejected"));
        return;
      }
      if (!res.ok) throw new Error(`submit failed: ${res.status}`);
      const data: SaveTeamResponse = await res.json();
      markLocalTeamSubmitted(team.id, data.team.slug);
      setTeams(
        (prev) =>
          prev?.map((x) =>
            x.id === team.id ? { ...x, submittedSlug: data.team.slug } : x
          ) ?? null
      );
      setToast(tr("submittedToast"));
    } catch {
      setToast(tr("submitFailed"));
    } finally {
      setSubmittingId(null);
    }
  };

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
        <p>{tr("empty", { size: teamSize })}</p>
        <Link
          href={PLAY_PATH[teamSize]}
          className="mt-2 inline-block font-semibold text-primary"
        >
          {tr("startDraft")}
        </Link>
      </div>
    );
  }

  const bestId = shown.reduce((a, b) => (compareRecords(b, a) > 0 ? b : a)).id;

  return (
    <>
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
            aria-label={tr("view", { name: t.name })}
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
                <span className="text-amber-400/90"> · {tr("olderData")}</span>
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
          {/* Submit-to-leaderboard: a link once it's on the board, an upload
              button otherwise. Disabled for older-data teams (the server would
              reject them with a 409 — the row already shows why). */}
          {t.submittedSlug ? (
            <Link
              href={`/t/${t.submittedSlug}`}
              aria-label={tr("onLeaderboard", { name: t.name })}
              className="relative z-10 shrink-0 rounded-md p-1 text-amber-400 transition-colors hover:bg-muted"
            >
              <Trophy className="size-3.5" />
            </Link>
          ) : (
            <button
              type="button"
              disabled={
                submittingId === t.id || t.snapshotVersion !== snapshotVersion
              }
              aria-label={tr("submit", { name: t.name })}
              onClick={() => submit(t)}
              className="relative z-10 shrink-0 rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-primary disabled:pointer-events-none disabled:opacity-40"
            >
              {submittingId === t.id ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Upload className="size-3.5" />
              )}
            </button>
          )}
          <button
            type="button"
            aria-label={tr("delete", { name: t.name })}
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

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            role="status"
            className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-md rounded-xl border border-border bg-popover px-4 py-3 text-sm text-popover-foreground shadow-lg"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

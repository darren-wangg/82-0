"use client";

/**
 * /teams/[id] — full view of a team saved on this device. The team lives in
 * localStorage, so everything is client-side: the snapshot + headshot map
 * load like the game does, the engine recomputes the full rating breakdown
 * from the stored roster, and the AI scouting report streams via the same
 * draft-kind explain request the sim screen uses (cached server-side by
 * content hash, so repeat views are free).
 *
 * Teams saved against an older snapshot version get a reduced view (name,
 * stored record/OVR, roster names) — the current engine/data can't honestly
 * re-rate them.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type {
  PlayerStatLine,
  Roster,
  SeasonResult,
  TeamRating,
} from "@/lib/contracts";
import { getEngine } from "@/lib/engine-provider";
import { headshotSources } from "@/lib/headshots-client";
import { loadHeadshotFallbacks } from "@/lib/headshots-client";
import {
  getBaselines,
  getPlayerMap,
  getSnapshot,
  loadSnapshot,
} from "@/lib/snapshot-client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LocalTeam, loadLocalTeams } from "@/components/game/local-teams";
import { CatBars } from "./cat-bars";
import { CatProfileInfo } from "./cat-profile-info";
import { ExplainStream } from "./explain-stream";
import { RecordHero } from "./record-hero";
import { RosterGrid } from "./roster-grid";

type ViewState =
  | { phase: "loading" }
  | { phase: "missing" }
  | { phase: "stale"; team: LocalTeam; players: Map<string, PlayerStatLine> }
  | {
      phase: "ready";
      team: LocalTeam;
      players: Map<string, PlayerStatLine>;
      roster: Roster;
      rating: TeamRating;
      season: SeasonResult;
    };

export function LocalTeamView() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<ViewState>({ phase: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const team = loadLocalTeams().find((t) => t.id === id) ?? null;
      if (!team) {
        if (!cancelled) setState({ phase: "missing" });
        return;
      }
      try {
        await Promise.all([loadSnapshot(), loadHeadshotFallbacks()]);
      } catch {
        // Snapshot unreachable — the stored numbers still tell the story.
        if (!cancelled)
          setState({ phase: "stale", team, players: new Map() });
        return;
      }
      if (cancelled) return;
      const players = getPlayerMap();
      const ids = [...Object.values(team.roster.starters), ...team.roster.bench];
      const current =
        team.snapshotVersion === getSnapshot().version &&
        ids.every((pid) => players.has(pid));
      if (!current) {
        setState({ phase: "stale", team, players });
        return;
      }
      const engine = getEngine();
      const rating = engine.teamRating(team.roster, players, getBaselines());
      const season = engine.projectSeason(rating);
      setState({
        phase: "ready",
        team,
        players,
        roster: team.roster,
        rating,
        season,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (state.phase === "loading") {
    return (
      <div className="mt-4 space-y-4" aria-busy>
        <Skeleton className="mx-auto h-20 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (state.phase === "missing") {
    return (
      <div className="mt-10 text-center text-sm text-muted-foreground">
        <p>This team isn&apos;t saved on this device.</p>
        <Link href="/teams" className="mt-2 inline-block font-semibold text-primary">
          ← Back to my teams
        </Link>
      </div>
    );
  }

  const { team } = state;
  const savedOn = new Date(team.savedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="mt-2 space-y-5">
      <div className="text-center">
        <h1 className="text-2xl font-black tracking-tight">{team.name}</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Saved on this device · {savedOn}
        </p>
      </div>

      {state.phase === "ready" ? (
        <>
          <RecordHero season={state.season} rating={state.rating} />
          <RosterGrid
            roster={state.roster}
            players={state.players}
            headshotSrcs={headshotSources}
          />
          <Card className="gap-2.5 border-border/60 bg-card/80 p-4">
            <p className="flex items-center gap-1 font-arcade text-[9px] text-muted-foreground uppercase">
              9-cat profile <CatProfileInfo />
            </p>
            <CatBars profile={state.rating.catProfile} />
          </Card>
          <Card className="gap-1.5 border-border/60 bg-card/80 p-4">
            <p className="font-arcade text-[9px] text-muted-foreground uppercase">
              Scouting report
            </p>
            <ExplainStream
              request={{
                kind: "draft",
                roster: state.roster,
                snapshotVersion: team.snapshotVersion,
              }}
            />
          </Card>
        </>
      ) : (
        <>
          {/* Stale: saved against older player data — show what was stored. */}
          <div className="text-center">
            <p className="text-6xl font-black tracking-tight tabular-nums">
              {team.wins}
              <span className="text-muted-foreground">–</span>
              {team.losses}
            </p>
            <p className="mt-1.5 font-arcade text-[9px] text-muted-foreground uppercase">
              Projected record · {Math.round(team.ovr)} OVR
            </p>
          </div>
          <p className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-center text-xs text-amber-200">
            Saved with older player data — the full ratings breakdown
            isn&apos;t available for this team anymore.
          </p>
        </>
      )}

      <Link
        href="/teams"
        className="flex items-center justify-center gap-1.5 pb-2 text-sm font-semibold text-primary"
      >
        <ArrowLeft className="size-4" /> Back to my teams
      </Link>
    </div>
  );
}

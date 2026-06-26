"use client";

/**
 * Matchup scoreboard with a count-up reveal (in the spirit of the post-draft
 * record count-up): the series score tallies up game-by-game and each team's
 * OVR ticks to its final while the bar lands. A franchise logo shows for any
 * side that is a famous preset team (the budget-challenge opponent).
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { TeamLogo } from "./team-logo";

/** requestAnimationFrame count-up to an integer target, easeOut. */
function useCountUp(target: number, durationMs: number): number {
  const [value, setValue] = useState(0);
  const reduce = useRef(false);
  useEffect(() => {
    reduce.current =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce.current) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(eased * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return value;
}

function TeamSide({
  name,
  slug,
  ovr,
  won,
  align,
  franchiseId,
}: {
  name: string;
  slug: string;
  ovr: number;
  won: boolean;
  align: "left" | "right";
  franchiseId: string | null;
}) {
  const shownOvr = useCountUp(Math.round(ovr), 1100);
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 flex-col gap-1",
        align === "right" ? "items-end text-right" : "items-start text-left"
      )}
    >
      {franchiseId && <TeamLogo franchiseId={franchiseId} className="size-10" />}
      {won && (
        <span className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase">
          Winner
        </span>
      )}
      <Link
        href={`/t/${slug}`}
        className="w-full truncate text-sm font-bold hover:underline"
      >
        {name}
      </Link>
      <span className="text-xs text-muted-foreground tabular-nums">
        OVR {shownOvr}
      </span>
    </div>
  );
}

export function MatchupScoreboard({
  teamAName,
  teamASlug,
  teamAOvr,
  teamAFranchise,
  teamBName,
  teamBSlug,
  teamBOvr,
  teamBFranchise,
  aWins,
  bWins,
  pGameA,
  winner,
}: {
  teamAName: string;
  teamASlug: string;
  teamAOvr: number;
  teamAFranchise: string | null;
  teamBName: string;
  teamBSlug: string;
  teamBOvr: number;
  teamBFranchise: string | null;
  aWins: number;
  bWins: number;
  pGameA: number;
  winner: "A" | "B";
}) {
  // Tally the series over ~1.4s, a touch slower than the OVRs so the score is
  // the last thing to land.
  const shownA = useCountUp(aWins, 1400);
  const shownB = useCountUp(bWins, 1400);
  const edgeTeam = pGameA >= 0.5 ? teamAName : teamBName;
  const edgePct = Math.round((pGameA >= 0.5 ? pGameA : 1 - pGameA) * 100);

  return (
    <div className="flex items-center gap-3">
      <TeamSide
        name={teamAName}
        slug={teamASlug}
        ovr={teamAOvr}
        won={winner === "A"}
        align="left"
        franchiseId={teamAFranchise}
      />
      <div className="shrink-0 text-center">
        <p className="text-5xl font-black tracking-tight tabular-nums">
          {shownA}
          <span className="text-muted-foreground">–</span>
          {shownB}
        </p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          {edgePct}% per-game edge to {edgeTeam}
        </p>
      </div>
      <TeamSide
        name={teamBName}
        slug={teamBSlug}
        ovr={teamBOvr}
        won={winner === "B"}
        align="right"
        franchiseId={teamBFranchise}
      />
    </div>
  );
}

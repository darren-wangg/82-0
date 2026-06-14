"use client";

/**
 * Per-category edge bars for a matchup: a centered diverging bar per cat.
 * Positive edge extends left toward team A, negative right toward team B.
 */

import { useFormatter } from "next-intl";
import { CatEdge } from "@/lib/contracts";
import { CAT_LABELS } from "./prompts";
import { cn } from "@/lib/utils";

const ONE_DP = { minimumFractionDigits: 1, maximumFractionDigits: 1 } as const;

const EDGE_SCALE = 3;

export function EdgeBars({
  breakdown,
  teamAName,
  teamBName,
}: {
  breakdown: CatEdge[];
  teamAName: string;
  teamBName: string;
}) {
  const format = useFormatter();
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
        <span className="max-w-[45%] truncate">{teamAName}</span>
        <span className="max-w-[45%] truncate text-right">{teamBName}</span>
      </div>
      {breakdown.map((e) => {
        const half = Math.min(Math.abs(e.edge) / EDGE_SCALE, 1) * 50;
        return (
          <div key={e.cat} className="space-y-0.5">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span className="font-mono tabular-nums">{format.number(e.teamA, ONE_DP)}</span>
              <span className="capitalize">{CAT_LABELS[e.cat]}</span>
              <span className="font-mono tabular-nums">{format.number(e.teamB, ONE_DP)}</span>
            </div>
            <div className="relative h-2 overflow-hidden rounded-full bg-muted">
              <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
              <div
                className={cn(
                  "absolute inset-y-0 rounded-full",
                  e.edge >= 0 ? "right-1/2 bg-sky-500" : "left-1/2 bg-orange-500"
                )}
                style={{ width: `${half}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

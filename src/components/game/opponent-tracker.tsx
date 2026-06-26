"use client";

/**
 * Compact collapsible opponent-progress strip shown above the draft during a
 * live lobby. Each opponent's picksCount/total is rendered as a thin bar.
 * Stays minimal/low-chrome per the project UI guidelines.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LiveParticipant } from "@/lib/live-lobby";

export function OpponentTracker({
  participants,
  myDisplayName,
}: {
  participants: LiveParticipant[];
  /** The current player's name so we can exclude them from the opponent list. */
  myDisplayName: string | null;
}) {
  const t = useTranslations("lobby");
  const [open, setOpen] = useState(true);

  const opponents = participants.filter(
    (p) => p.displayName !== myDisplayName
  );

  if (opponents.length === 0) return null;

  return (
    <div className="mb-2 rounded-xl border border-border/60 bg-card/60 px-3 py-1.5">
      <button
        type="button"
        className="flex w-full items-center justify-between text-[10px] font-bold tracking-wider text-muted-foreground uppercase"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>{t("liveProgress")}</span>
        {open ? (
          <ChevronUp className="size-3" />
        ) : (
          <ChevronDown className="size-3" />
        )}
      </button>

      {open && (
        <div className="mt-1.5 flex flex-col gap-1">
          {opponents.map((p) => {
            const pct = p.total > 0 ? (p.picksCount / p.total) * 100 : 0;
            return (
              <div key={p.displayName} className="flex items-center gap-2">
                <span className="w-20 truncate text-[10px] text-muted-foreground">
                  {p.displayName}
                </span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      p.done ? "bg-emerald-500" : "bg-primary/70"
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-8 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                  {p.picksCount}/{p.total}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

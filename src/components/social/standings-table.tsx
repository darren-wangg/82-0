/** Lobby standings table (already sorted: wins desc, then ovr desc). */

import Link from "next/link";
import { Crown } from "lucide-react";
import { LobbyStanding } from "@/lib/contracts";
import { cn } from "@/lib/utils";

/** Podium colors for the top three ranks. */
const RANK_COLOR = ["text-amber-400", "text-zinc-300", "text-amber-700"];

export function StandingsTable({
  standings,
  viewerTeamSlug = null,
  open = false,
}: {
  standings: LobbyStanding[];
  /** The viewer's entry, highlighted as theirs. */
  viewerTeamSlug?: string | null;
  /** While open, the top seed wears a "leader" crown instead of medals. */
  open?: boolean;
}) {
  if (standings.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
        No teams yet
      </p>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-[10px] tracking-widest text-muted-foreground uppercase">
          <th className="pr-2 pb-1 text-left font-medium">#</th>
          <th className="pr-2 pb-1 text-left font-medium">Team</th>
          <th className="pr-2 pb-1 text-right font-medium">W–L</th>
          <th className="pb-1 text-right font-medium">OVR</th>
        </tr>
      </thead>
      <tbody>
        {standings.map((s, i) => {
          const yours = viewerTeamSlug !== null && s.teamSlug === viewerTeamSlug;
          return (
            <tr
              key={s.teamSlug}
              className={cn(
                "border-t border-border/60",
                yours && "bg-primary/10"
              )}
            >
              <td
                className={cn(
                  "py-2 pr-2 font-bold tabular-nums",
                  RANK_COLOR[i] ?? "text-muted-foreground"
                )}
              >
                {i + 1}
                {open && i === 0 && standings.length > 1 && (
                  <Crown className="ml-1 inline size-3.5 -translate-y-px text-amber-400" />
                )}
              </td>
              <td className="max-w-0 py-2 pr-2">
                <Link
                  href={`/t/${s.teamSlug}`}
                  className="block truncate font-medium hover:underline"
                >
                  {s.teamName}
                </Link>
                <span className="block truncate text-xs text-muted-foreground">
                  {s.displayName ?? "anonymous GM"}
                  {yours && (
                    <span className="ml-1 font-semibold text-primary">· You</span>
                  )}
                </span>
              </td>
              <td className="py-2 pr-2 text-right font-mono tabular-nums">
                {s.wins}–{s.losses}
              </td>
              <td className="py-2 text-right font-mono tabular-nums">
                {Math.round(s.ovr)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

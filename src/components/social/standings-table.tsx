/** Lobby standings table (already sorted: wins desc, then ovr desc). */

import { LobbyStanding } from "@/lib/contracts";
import Link from "next/link";

export function StandingsTable({ standings }: { standings: LobbyStanding[] }) {
  if (standings.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
        No teams yet — be the first to join.
      </p>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-[10px] tracking-widest text-muted-foreground uppercase">
          <th className="pb-1 pr-2 text-left font-medium">#</th>
          <th className="pb-1 pr-2 text-left font-medium">Team</th>
          <th className="pb-1 pr-2 text-right font-medium">W–L</th>
          <th className="pb-1 text-right font-medium">OVR</th>
        </tr>
      </thead>
      <tbody>
        {standings.map((s, i) => (
          <tr key={s.teamSlug} className="border-t border-border/60">
            <td className="py-2 pr-2 tabular-nums text-muted-foreground">{i + 1}</td>
            <td className="max-w-0 py-2 pr-2">
              <Link href={`/t/${s.teamSlug}`} className="block truncate font-medium hover:underline">
                {s.teamName}
              </Link>
              {s.displayName && (
                <span className="block truncate text-xs text-muted-foreground">
                  {s.displayName}
                </span>
              )}
            </td>
            <td className="py-2 pr-2 text-right font-mono tabular-nums">
              {s.wins}–{s.losses}
            </td>
            <td className="py-2 text-right font-mono tabular-nums">
              {Math.round(s.ovr)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

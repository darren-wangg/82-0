/**
 * Server component: a team's recent head-to-head battles. Renders nothing
 * when the team has never battled (or the DB is unreachable) — the team page
 * stays useful either way.
 */

import Link from "next/link";
import { loadBattleHistory } from "@/app/api/_lib/battles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export async function BattleHistory({ slug }: { slug: string }) {
  let history;
  try {
    history = await loadBattleHistory(slug);
  } catch {
    return null;
  }
  if (history.rows.length === 0) return null;

  const { rows, record } = history;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Battle history</CardTitle>
        <p className="text-xs text-muted-foreground">
          {record.wins}–{record.losses} in head-to-head battles
        </p>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1">
          {rows.map((b) => (
            <li key={b.matchupId} className="flex items-center gap-2 text-sm">
              <Link
                href={`/m/${b.matchupId}`}
                className={cn(
                  "w-14 shrink-0 font-mono text-xs font-bold tabular-nums",
                  b.won ? "text-emerald-400" : "text-red-400"
                )}
              >
                {b.won ? "W" : "L"} {b.series[0]}–{b.series[1]}
              </Link>
              <Link
                href={`/t/${b.opponentSlug}`}
                className="min-w-0 flex-1 truncate font-semibold"
              >
                vs {b.opponentName}
              </Link>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {formatDate(b.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/**
 * /l — group-lobby hub: create a lobby, or join an open one from the global
 * list. The list shows every lobby that's still open and was started within
 * the last 24h (newest first); closed or aged-out lobbies drop off the board
 * automatically to keep it clean.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { Plus, UsersRound } from "lucide-react";
import { loadActiveLobbies, type ActiveLobbySummary } from "@/app/api/_lib/lobbies";
import { buttonVariants } from "@/components/ui/button";
import { Unavailable } from "@/components/social/unavailable";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Group lobbies",
  description: "Create a group lobby or join an open one and settle who drafts best.",
};

// The entrant counts change as people join, so always render fresh.
export const dynamic = "force-dynamic";

export default async function LobbiesPage() {
  let lobbies: ActiveLobbySummary[];
  try {
    lobbies = await loadActiveLobbies();
  } catch {
    return <Unavailable what="open lobbies" />;
  }

  return (
    <main className="flex flex-1 flex-col">
      <h1 className="font-display text-3xl tracking-wide">Group lobbies</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Everyone drafts a team, every matchup runs head-to-head, and the creator
        crowns the champ.
      </p>

      <Link
        href="/l/new"
        className={cn(
          buttonVariants({ size: "lg" }),
          "mt-4 h-12 w-full rounded-xl font-bold"
        )}
      >
        <Plus className="size-5" /> Create a lobby
      </Link>

      <h2 className="mt-7 mb-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
        Open lobbies
      </h2>

      {lobbies.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 px-4 py-10 text-center text-sm text-muted-foreground">
          <UsersRound className="mx-auto mb-2 size-6 opacity-60" />
          <p>No open lobbies right now.</p>
          <p className="mt-0.5 text-xs">Start one and share the link.</p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {lobbies.map((lobby) => (
            <li
              key={lobby.code}
              className="relative flex items-center gap-3 rounded-xl border border-border/80 bg-card/70 px-3 py-2.5 shadow-md shadow-black/25"
            >
              <Link
                href={`/l/${lobby.code}`}
                aria-label={`Open the ${lobby.name} lobby`}
                className="absolute inset-0 rounded-xl"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">
                  {lobby.name}
                </span>
                <span className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
                  {lobby.code}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-muted-foreground tabular-nums">
                <UsersRound className="size-3.5" />
                {lobby.entrantCount}
              </span>
              <span className="w-12 shrink-0 text-right font-mono text-xs text-muted-foreground tabular-nums">
                {lobby.avgOvr === null ? "—" : `${Math.round(lobby.avgOvr)} OVR`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

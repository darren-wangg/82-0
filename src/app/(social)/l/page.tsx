/**
 * /l — group-lobby hub: create a lobby, or join an open one from the global
 * list. The list shows every lobby that's still open (newest first), no matter
 * its age; a lobby drops off the board only once its creator closes it.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { Plus, UsersRound } from "lucide-react";
import { loadActiveLobbies, type ActiveLobbySummary } from "@/app/api/_lib/lobbies";
import { buttonVariants } from "@/components/ui/button";
import { Unavailable } from "@/components/social/unavailable";
import { TeamSizeSwitch } from "@/components/team-size-switch";
import { resolveTeamSize, TEAM_SIZE_COOKIE } from "@/lib/team-size";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Group lobbies",
  description: "Create a group lobby or join an open one and settle who drafts best.",
};

// The entrant counts change as people join, so always render fresh.
export const dynamic = "force-dynamic";

export default async function LobbiesPage() {
  const teamSize = resolveTeamSize(
    (await cookies()).get(TEAM_SIZE_COOKIE)?.value
  );

  let lobbies: ActiveLobbySummary[];
  try {
    lobbies = await loadActiveLobbies(teamSize);
  } catch {
    return <Unavailable what="open lobbies" />;
  }

  return (
    <main className="flex flex-1 flex-col">
      <div className="flex items-start justify-between gap-3">
        <h1 className="font-display text-3xl tracking-wide">Group lobbies</h1>
        <TeamSizeSwitch value={teamSize} className="mt-1" />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Everyone drafts a team, every matchup runs head-to-head, and a champion is crowned.
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
          <p>No open {teamSize}-man lobbies right now.</p>
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
              {/* No per-row size badge: the list is already filtered to the
                  selected team size by the switch above. */}
              {lobby.teamLimit !== null && lobby.entrantCount >= lobby.teamLimit && (
                <span className="shrink-0 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-amber-400 uppercase">
                  Full
                </span>
              )}
              <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-muted-foreground tabular-nums">
                <UsersRound className="size-3.5" />
                {lobby.entrantCount}
                {lobby.teamLimit !== null && (
                  <span className="text-muted-foreground/70">/{lobby.teamLimit}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

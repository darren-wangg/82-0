/**
 * /l/[code] — group lobby: anyone with the link drafts a fresh team while
 * the lobby is open (until the creator ends it), one team per device.
 * Standings run every entry head-to-head (manual refresh via the status
 * chip); the leader is crowned champion when the creator closes the lobby.
 * Team rows link to full details (roster, 9-cat, OFF/DEF).
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Trophy, UserRoundPlus } from "lucide-react";
import { LobbyResponse } from "@/lib/contracts";
import { loadLobbyResponse, loadLobbyViewer } from "@/app/api/_lib/lobbies";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CloseLobbyButton } from "@/components/social/close-lobby-button";
import { CopyCode } from "@/components/social/copy-code";
import { DownloadCardButton } from "@/components/social/download-card";
import { LobbyCloseNotifier } from "@/components/social/lobby-close-notifier";
import { LobbyLimitEditor } from "@/components/social/lobby-limit-editor";
import { LobbyRefresh } from "@/components/social/lobby-refresh";
import { ShareButton } from "@/components/social/share-button";
import { StandingsTable } from "@/components/social/standings-table";
import { Unavailable } from "@/components/social/unavailable";

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

export async function generateMetadata({
  params,
}: PageProps<"/l/[code]">): Promise<Metadata> {
  const { code } = await params;
  try {
    const lobby = await loadLobbyResponse(code);
    return lobby
      ? {
          title: `${lobby.name} lobby`,
          description: `Draft a fresh all-time roster for the "${lobby.name}" lobby and fight for the crown.`,
        }
      : { title: "Lobby" };
  } catch {
    return { title: "Lobby" };
  }
}

export default async function LobbyPage({ params }: PageProps<"/l/[code]">) {
  const { code } = await params;

  let lobby: LobbyResponse | null;
  let viewer: Awaited<ReturnType<typeof loadLobbyViewer>>;
  try {
    lobby = await loadLobbyResponse(code);
    viewer = await loadLobbyViewer(code);
  } catch {
    return <Unavailable what="this lobby" />;
  }
  if (!lobby) notFound();

  const open = lobby.status === "open";
  const entered = viewer.entryTeamSlug !== null;
  const teamCount = lobby.standings.length;
  const limit = viewer.teamLimit;
  const full = limit !== null && teamCount >= limit;
  const placementIdx = entered
    ? lobby.standings.findIndex((s) => s.teamSlug === viewer.entryTeamSlug)
    : -1;
  const placement = placementIdx >= 0 ? placementIdx + 1 : null;

  return (
    <main className="space-y-5">
      <div className="text-center">
        <h1 className="text-2xl font-black tracking-tight">{lobby.name}</h1>
        <p className="mt-1.5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <CopyCode code={lobby.code} />
          {open ? (
            <LobbyRefresh />
          ) : (
            <span className="font-semibold text-amber-400">Closed</span>
          )}
        </p>
        <p className="mt-1 text-xs font-medium text-muted-foreground tabular-nums">
          {teamCount}
          {limit !== null && <span className="text-muted-foreground/70">/{limit}</span>}{" "}
          {teamCount === 1 && limit === null ? "team" : "teams"}
          {full && open && (
            <span className="ml-1.5 font-bold text-amber-400 uppercase">· Full</span>
          )}
        </p>
      </div>

      {lobby.winner && (
        <Card className="border-amber-500/40 bg-amber-500/10">
          <CardContent className="flex items-center gap-3 py-4">
            <Trophy className="size-8 shrink-0 text-amber-400" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold tracking-widest text-amber-400 uppercase">
                Lobby champion
              </p>
              <Link
                href={`/t/${lobby.winner.teamSlug}`}
                className="block truncate text-lg font-black hover:underline"
              >
                {lobby.winner.teamName}
              </Link>
              <p className="text-xs text-muted-foreground">
                {lobby.winner.wins}–{lobby.winner.losses} head-to-head
                {lobby.winner.displayName ? ` · ${lobby.winner.displayName}` : ""}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!open && placement !== null && placement !== 1 && (
        <Card className="border-primary/40 bg-primary/10">
          <CardContent className="py-3 text-center">
            <p className="text-[10px] font-semibold tracking-widest text-primary uppercase">
              Your result
            </p>
            <p className="mt-0.5 text-sm font-bold">
              You finished {ordinal(placement)} of {teamCount}
            </p>
          </CardContent>
        </Card>
      )}

      {open &&
        (entered ? (
          <Card>
            <CardContent className="py-4 text-center text-sm">
              You&apos;re in!{" "}
              <Link
                href={`/t/${viewer.entryTeamSlug}`}
                className="font-semibold text-primary hover:underline"
              >
                View your team
              </Link>
              {teamCount < 2 ? (
                <span className="mt-1 block text-xs text-muted-foreground">
                  Nobody to beat yet — send the invite, then tap the refresh
                  icon up top to check for new entries.
                </span>
              ) : (
                <span className="mt-1 block text-xs text-muted-foreground">
                  Tap the refresh icon up top to check for new entries.
                </span>
              )}
            </CardContent>
          </Card>
        ) : full ? (
          <Card className="border-amber-500/40 bg-amber-500/10">
            <CardContent className="py-4 text-center text-sm">
              <p className="font-semibold text-amber-400">This lobby is full</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                All {limit} spots are taken — follow the standings below.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            <Link
              href={`/play?lobby=${encodeURIComponent(lobby.code)}`}
              className={cn(
                buttonVariants({ size: "lg" }),
                "h-14 w-full rounded-2xl font-display text-xl tracking-wide shadow-lg shadow-primary/30"
              )}
            >
              Draft your team
            </Link>
            <p className="text-center text-[11px] text-muted-foreground">
              Draft a single team for this lobby — no re-dos.
              {limit !== null && ` ${limit - teamCount} spot${limit - teamCount === 1 ? "" : "s"} left.`}
            </p>
          </div>
        ))}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            Standings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <StandingsTable
            standings={lobby.standings}
            viewerTeamSlug={viewer.entryTeamSlug}
            open={open}
          />
        </CardContent>
      </Card>

      {!open && teamCount > 0 && (
        <DownloadCardButton
          cardUrl={`/l/${lobby.code}/card`}
          fileName={`ultimate-draft-lobby-${lobby.code}.png`}
          label="Save the game summary"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "w-full"
          )}
        />
      )}

      {open && (
        <>
          <ShareButton
            title={`Join my "${lobby.name}" lobby on Ultimate Draft`}
            path={`/l/${lobby.code}`}
            label="Invite friends"
            className={cn(
              "w-full",
              // The whole point of a lobby is opponents — make inviting loud
              // until there are at least two teams in.
              teamCount < 2 && "border-primary/60 text-primary"
            )}
          />
          {!entered && teamCount > 0 && (
            <p className="-mt-3 flex items-center justify-center gap-1 text-center text-[11px] text-muted-foreground">
              <UserRoundPlus className="size-3" /> Friends join with the code or
              the link
            </p>
          )}
          {viewer.isCreator && (
            <div className="flex flex-col items-center gap-3 border-t border-border/60 pt-4">
              <LobbyLimitEditor
                code={lobby.code}
                currentLimit={limit}
                entrantCount={teamCount}
              />
              <CloseLobbyButton code={lobby.code} />
            </div>
          )}
        </>
      )}

      {entered && (
        <LobbyCloseNotifier
          code={lobby.code}
          open={open}
          entered={entered}
          placement={placement}
          total={teamCount}
          lobbyName={lobby.name}
        />
      )}
    </main>
  );
}

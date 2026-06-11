/**
 * /l/[code] — group lobby: anyone with the link drafts a fresh team while
 * entries are open (24h, or until the creator ends it), one team per device.
 * Standings run every entry head-to-head; the leader is crowned when the
 * lobby closes. Team rows link to full details (roster, 9-cat, OFF/DEF).
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Trophy } from "lucide-react";
import { LobbyResponse } from "@/lib/contracts";
import { loadLobbyResponse, loadLobbyViewer } from "@/app/api/_lib/lobbies";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CloseLobbyButton } from "@/components/social/close-lobby-button";
import { LobbyCountdown } from "@/components/social/lobby-countdown";
import { ShareButton } from "@/components/social/share-button";
import { StandingsTable } from "@/components/social/standings-table";
import { Unavailable } from "@/components/social/unavailable";

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

  return (
    <main className="space-y-5">
      <div className="text-center">
        <h1 className="text-2xl font-black tracking-tight">{lobby.name}</h1>
        <p className="mt-1.5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          Lobby code
          <Badge variant="outline" className="font-mono text-xs tracking-widest">
            {lobby.code}
          </Badge>
          {open ? (
            <LobbyCountdown closesAt={lobby.closesAt} />
          ) : (
            <span className="font-semibold text-amber-400">Closed</span>
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

      {open &&
        (viewer.entryTeamSlug ? (
          <Card>
            <CardContent className="py-4 text-center text-sm">
              You&apos;re in!{" "}
              <Link
                href={`/t/${viewer.entryTeamSlug}`}
                className="font-semibold text-primary hover:underline"
              >
                View your team
              </Link>{" "}
              and watch the standings as entries arrive.
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
              Every entry is drafted fresh for this lobby — one team per device.
            </p>
          </div>
        ))}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            Standings
            <span className="ml-2 font-normal text-muted-foreground">
              round-robin, every team plays every team
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <StandingsTable standings={lobby.standings} />
        </CardContent>
      </Card>

      {open && (
        <>
          <ShareButton
            title={`Join my "${lobby.name}" lobby on 82-0 Plus`}
            path={`/l/${lobby.code}`}
            label="Invite friends"
            className="w-full"
          />
          {viewer.isCreator && <CloseLobbyButton code={lobby.code} />}
        </>
      )}
    </main>
  );
}

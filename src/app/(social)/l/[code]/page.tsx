/**
 * /l/[code] — async lobby page: join with a saved team, round-robin standings
 * (simulated server-side per request), and a share action.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LobbyResponse } from "@/lib/contracts";
import { loadLobbyResponse } from "@/app/api/_lib/lobbies";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JoinLobbyForm } from "@/components/social/join-lobby-form";
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
          description: `Join the "${lobby.name}" lobby with your all-time roster and fight for first place.`,
        }
      : { title: "Lobby" };
  } catch {
    return { title: "Lobby" };
  }
}

export default async function LobbyPage({ params }: PageProps<"/l/[code]">) {
  const { code } = await params;

  let lobby: LobbyResponse | null;
  try {
    lobby = await loadLobbyResponse(code);
  } catch {
    return <Unavailable what="this lobby" />;
  }
  if (!lobby) notFound();

  return (
    <main className="space-y-5">
      <div className="text-center">
        <h1 className="text-2xl font-black tracking-tight">{lobby.name}</h1>
        <p className="mt-1.5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          Lobby code
          <Badge variant="outline" className="font-mono text-xs tracking-widest">
            {lobby.code}
          </Badge>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Join with your team</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <JoinLobbyForm code={lobby.code} />
          <p className="text-[11px] text-muted-foreground">
            Save a team in the game first, then paste its share link here.
          </p>
        </CardContent>
      </Card>

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

      <ShareButton
        title={`Join my "${lobby.name}" lobby on 82-0 Plus`}
        path={`/l/${lobby.code}`}
        label="Invite friends"
        className="w-full"
      />
    </main>
  );
}

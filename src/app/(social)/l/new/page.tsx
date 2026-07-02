/**
 * /l/new — create an async group lobby: anyone with the link drafts a fresh
 * team (one per device), standings run round-robin sims live as entries
 * arrive, and the creator closes the lobby to crown the champion.
 */

import type { Metadata } from "next";
import { cookies } from "next/headers";
import { CreateLobbyForm } from "@/components/social/create-lobby-form";
import { resolveTeamSize, TEAM_SIZE_COOKIE } from "@/lib/team-size";

export const metadata: Metadata = {
  title: "New lobby",
  description: "Start a group lobby and settle who drafts best.",
};

export default async function NewLobbyPage() {
  // Default the size picker to the session preference.
  const teamSize = resolveTeamSize(
    (await cookies()).get(TEAM_SIZE_COOKIE)?.value
  );
  return (
    <main className="flex flex-1 flex-col justify-center space-y-6">
      <div className="text-center">
        <p className="text-xs font-semibold tracking-widest text-primary uppercase">
          Group Lobby
        </p>
        <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
          Everyone drafts a team. Matchups run head-to-head, and the lobby
          stays open until you crown the champ.
        </p>
      </div>
      <CreateLobbyForm defaultSize={teamSize} />
    </main>
  );
}

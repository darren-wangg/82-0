/**
 * /l/new — create an async group lobby: anyone with the link drafts a fresh
 * team (one per device), standings run round-robin sims live as entries
 * arrive, and the creator closes the lobby to crown the champion.
 */

import type { Metadata } from "next";
import { CreateLobbyForm } from "@/components/social/create-lobby-form";

export const metadata: Metadata = {
  title: "New lobby",
  description: "Start a group lobby and settle who drafts best.",
};

export default function NewLobbyPage() {
  return (
    <main className="flex flex-1 flex-col justify-center space-y-6">
      <div className="text-center">
        <p className="text-xs font-semibold tracking-widest text-primary uppercase">
          Group lobby
        </p>
        <h1 className="mt-2 font-display text-3xl tracking-wide">
          Settle it as a group
        </h1>
        <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
          Create a lobby and share the link. Everyone drafts a team. Every matchup runs head-to-head, and the lobby
          stays open until you end it and crown the champ.
        </p>
      </div>
      <CreateLobbyForm />
    </main>
  );
}

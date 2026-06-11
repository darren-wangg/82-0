/**
 * /l/new — create an async group lobby: anyone with the link drafts a fresh
 * team (one per device) within 24 hours, standings run round-robin sims as
 * entries arrive, and a winner is crowned when the lobby closes.
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
          Create a lobby and share the link — everyone drafts a fresh team,
          one per device, within 24 hours. Every matchup runs head-to-head,
          and the winner is crowned when the lobby closes.
        </p>
      </div>
      <CreateLobbyForm />
    </main>
  );
}

/**
 * /l/new — create an async group lobby: friends submit saved teams and the
 * standings update with round-robin head-to-head sims as entries arrive.
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
          Create a lobby, share the link, and everyone submits a saved team.
          Standings run every matchup head-to-head — round-robin, best-of-7s.
        </p>
      </div>
      <CreateLobbyForm />
    </main>
  );
}

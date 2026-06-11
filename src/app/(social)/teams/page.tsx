/**
 * /teams — teams saved to this device (localStorage only, no server copy),
 * newest first. The list itself is a client component.
 */

import type { Metadata } from "next";
import { getSnapshot } from "@/lib/snapshot";
import { MyTeams } from "@/components/social/my-teams";

export const metadata: Metadata = {
  title: "My teams",
  description: "Teams you've saved on this device.",
};

export default function TeamsPage() {
  return (
    <main className="flex flex-1 flex-col">
      <h1 className="font-display text-3xl tracking-wide">My teams</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Saved on this device only.
      </p>
      {/* Version passed from the server so the client needn't fetch the snapshot. */}
      <MyTeams snapshotVersion={getSnapshot().version} />
    </main>
  );
}

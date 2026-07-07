/**
 * /teams/[id] — detail view for a team saved on this device. The team data
 * lives in localStorage, so the page is a static shell around a client
 * component; the [id] segment is read client-side via useParams.
 */

import type { Metadata } from "next";
import { LocalTeamView } from "@/components/social/local-team-view";
import { preloadGameData } from "@/lib/preload-game-data";

export const metadata: Metadata = {
  title: "My team",
  description: "A team saved on this device.",
};

export default function LocalTeamPage() {
  // LocalTeamView renders the roster from the client-fetched snapshot — start
  // that download from the initial HTML instead of after hydration.
  preloadGameData();
  return (
    <main className="flex flex-1 flex-col">
      <LocalTeamView />
    </main>
  );
}

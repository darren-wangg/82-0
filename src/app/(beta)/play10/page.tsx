import type { Metadata } from "next";
import { Suspense } from "react";
import { PlayScreen } from "@/components/game/play-screen";

export const metadata: Metadata = { title: "10-Player Draft (Beta) — 82-0" };

export default function Play10Page() {
  // Suspense boundary: PlayScreen reads search params via useSearchParams.
  return (
    <Suspense>
      <PlayScreen />
    </Suspense>
  );
}

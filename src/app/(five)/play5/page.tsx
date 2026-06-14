import type { Metadata } from "next";
import { Suspense } from "react";
import { PlayScreen } from "@/components/game/play-screen";

export const metadata: Metadata = { title: "5-Man Draft — 82-0" };

export default function Play5Page() {
  // Suspense boundary: PlayScreen reads search params via useSearchParams.
  return (
    <Suspense>
      <PlayScreen />
    </Suspense>
  );
}

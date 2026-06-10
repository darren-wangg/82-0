import type { Metadata } from "next";
import { Suspense } from "react";
import { PlayScreen } from "@/components/game/play-screen";

export const metadata: Metadata = { title: "Draft — 82-0" };

export default function PlayPage() {
  // Suspense boundary: PlayScreen reads ?challenge= via useSearchParams.
  return (
    <Suspense>
      <PlayScreen />
    </Suspense>
  );
}

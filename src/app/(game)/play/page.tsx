import type { Metadata } from "next";
import { PlayScreen } from "@/components/game/play-screen";

export const metadata: Metadata = { title: "Draft — 82-0" };

export default function PlayPage() {
  return <PlayScreen />;
}

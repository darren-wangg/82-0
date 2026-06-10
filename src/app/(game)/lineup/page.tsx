import type { Metadata } from "next";
import { LineupScreen } from "@/components/game/lineup-screen";

export const metadata: Metadata = { title: "Lineup — 82-0" };

export default function LineupPage() {
  return <LineupScreen />;
}

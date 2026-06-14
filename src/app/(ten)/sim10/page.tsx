import type { Metadata } from "next";
import { SimScreen } from "@/components/game/sim-screen";

export const metadata: Metadata = { title: "10-Man Season — 82-0" };

export default function Sim10Page() {
  return <SimScreen />;
}

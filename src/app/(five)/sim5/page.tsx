import type { Metadata } from "next";
import { SimScreen } from "@/components/game/sim-screen";

export const metadata: Metadata = { title: "5-Man Season — 82-0" };

export default function Sim5Page() {
  return <SimScreen />;
}

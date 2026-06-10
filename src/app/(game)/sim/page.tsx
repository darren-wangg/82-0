import type { Metadata } from "next";
import { SimScreen } from "@/components/game/sim-screen";

export const metadata: Metadata = { title: "Season — 82-0" };

export default function SimPage() {
  return <SimScreen />;
}

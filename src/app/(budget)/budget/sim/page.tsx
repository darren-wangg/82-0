import type { Metadata } from "next";
import { BudgetSimScreen } from "@/components/game/budget-sim-screen";

export const metadata: Metadata = { title: "Budget Season — 82-0" };

export default function BudgetSimPage() {
  return <BudgetSimScreen />;
}

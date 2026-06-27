import type { Metadata } from "next";
import { Suspense } from "react";
import { BudgetPlayScreen } from "@/components/game/budget-play-screen";

export const metadata: Metadata = { title: "Budget Draft — 82-0" };

export default function BudgetPlayPage() {
  return (
    <Suspense>
      <BudgetPlayScreen />
    </Suspense>
  );
}

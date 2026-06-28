import type { Metadata } from "next";
import { Suspense } from "react";
import { BudgetChallengeScreen } from "@/components/game/budget-challenge-screen";

export const metadata: Metadata = { title: "Play a Historic Team — 82-0" };

export default function BudgetChallengePage() {
  return (
    <Suspense>
      <BudgetChallengeScreen />
    </Suspense>
  );
}

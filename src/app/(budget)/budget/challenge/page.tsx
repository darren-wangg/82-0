import type { Metadata } from "next";
import { Suspense } from "react";
import { BudgetChallengeScreen } from "@/components/game/budget-challenge-screen";

export const metadata: Metadata = { title: "Challenge a Famous Team — 82-0" };

export default function BudgetChallengePage() {
  return (
    <Suspense>
      <BudgetChallengeScreen />
    </Suspense>
  );
}

"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DRAFT_ROUNDS,
  ERA_SKIPS_PER_GAME,
  EXCLUDED_DECADES_PER_GAME,
  SEASON_GAMES,
  TEAM_SKIPS_PER_GAME,
} from "@/lib/contracts";

const STEPS: { title: string; body: string }[] = [
  {
    title: "Spin",
    body: `Each of the ${DRAFT_ROUNDS} rounds spins up a random franchise and decade. ${EXCLUDED_DECADES_PER_GAME} decades are knocked out of every game — check the banned chips before you start.`,
  },
  {
    title: "Skip (maybe)",
    body: `You get ${TEAM_SKIPS_PER_GAME} team skip and ${ERA_SKIPS_PER_GAME} era skip per game. A skip re-spins only that axis — spend them wisely.`,
  },
  {
    title: "Pick",
    body: "Draft exactly one player from the spun pool. You can never draft the same player twice, even from a different era.",
  },
  {
    title: "Set your lineup",
    body: "Assign 5 starters (PG / SG / SF / PF / C) and 3 bench spots. Out-of-position starters are allowed, but flagged — and it costs you.",
  },
  {
    title: "Simulate",
    body: `Your squad is era-adjusted and runs a full ${SEASON_GAMES}-game season. One glaring weakness can cap your wins. Chase ${SEASON_GAMES}-0.`,
  },
];

export function HowToPlayDialog() {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="ghost" size="lg" className="h-11 text-muted-foreground" />
        }
      >
        How to play
      </DialogTrigger>
      <DialogContent className="dark max-h-[85dvh] overflow-y-auto border-border bg-background text-foreground">
        <DialogHeader>
          <DialogTitle className="text-lg">How to play</DialogTitle>
          <DialogDescription>
            Build the greatest team of all time, one spin at a time.
          </DialogDescription>
        </DialogHeader>
        <ol className="flex flex-col gap-4 pb-1">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-3">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-xs font-bold text-primary-foreground">
                {i + 1}
              </span>
              <div>
                <p className="font-semibold">{step.title}</p>
                <p className="text-sm text-muted-foreground">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  );
}

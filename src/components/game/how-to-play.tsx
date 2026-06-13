"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ERA_SKIPS_PER_GAME,
  TEAM_SKIPS_PER_GAME,
} from "@/lib/contracts";

const STEPS: { title: string; body: string }[] = [
  {
    title: "Spin",
    body: `Spin for a random team and era. The same team-era combo never comes up twice.`,
  },
  {
    title: "Re-spins",
    body: `${TEAM_SKIPS_PER_GAME} team re-spin and ${ERA_SKIPS_PER_GAME} era re-spin per game. A re-spin rolls only that axis.`,
  },
  {
    title: "Pick",
    body: "Tap a player, then one of their positions. Starters need a PG, SG, SF, PF, C. The bench needs a G, a F, and C.",
  },
  {
    title: "Optimize",
    body: "You can rearrange drafted players between eligible slots any time during the draft."
  },
  {
    title: "Simulate",
    body: "Your team is era-adjusted and runs a full season. One weakness can cap your wins.",
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

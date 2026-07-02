"use client";

import { useTranslations } from "next-intl";
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

const STEP_KEYS = ["spin", "reSpins", "pick", "optimize", "simulate"] as const;

export function HowToPlayDialog() {
  const t = useTranslations("howToPlay");
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="ghost" size="lg" className="h-11 text-muted-foreground" />
        }
      >
        {t("trigger")}
      </DialogTrigger>
      <DialogContent className="dark max-h-[85svh] overflow-y-auto border-border bg-background text-foreground">
        <DialogHeader>
          <DialogTitle className="text-lg">{t("title")}</DialogTitle>
        </DialogHeader>
        <ol className="flex flex-col gap-4 pb-1">
          {STEP_KEYS.map((key, i) => (
            <li key={key} className="flex gap-3">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-xs font-bold text-primary-foreground">
                {i + 1}
              </span>
              <div>
                <p className="font-semibold">{t(`steps.${key}.title`)}</p>
                <p className="text-sm text-muted-foreground">
                  {t(`steps.${key}.body`, {
                    teamSkips: TEAM_SKIPS_PER_GAME,
                    eraSkips: ERA_SKIPS_PER_GAME,
                  })}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  );
}

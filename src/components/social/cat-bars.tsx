"use client";

/**
 * 9-cat profile bars on a ~±3 era-adjusted z-scale, centered at 0.
 * Higher is always better (negative cats are sign-flipped upstream).
 */

import { useFormatter } from "next-intl";
import { NINE_CATS, NineCat } from "@/lib/contracts";
import { CAT_LABELS } from "./prompts";
import { cn } from "@/lib/utils";

const Z_SCALE = 3;

export function CatBars({ profile }: { profile: Record<NineCat, number> }) {
  const format = useFormatter();
  return (
    <div className="space-y-1.5">
      {NINE_CATS.map((cat) => {
        const v = profile[cat] ?? 0;
        const half = Math.min(Math.abs(v) / Z_SCALE, 1) * 50;
        return (
          <div key={cat} className="flex items-center gap-2 text-xs">
            <span className="w-24 shrink-0 truncate text-muted-foreground capitalize">
              {CAT_LABELS[cat]}
            </span>
            <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
              <div
                className={cn(
                  "absolute inset-y-0 rounded-full",
                  v >= 0 ? "left-1/2 bg-emerald-500" : "right-1/2 bg-red-500/80"
                )}
                style={{ width: `${half}%` }}
              />
            </div>
            <span className="w-10 shrink-0 text-right font-mono tabular-nums">
              {format.number(v, {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
                signDisplay: "always",
              })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

"use client";

/**
 * Budget meter: shows Spent $X / $CAP with a progress bar.
 * Turns red when over budget (server will reject saves exceeding the cap).
 */

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export function BudgetMeter({
  spent,
  cap,
  className,
}: {
  spent: number;
  cap: number;
  className?: string;
}) {
  const t = useTranslations("budget");
  const pct = Math.min(100, (spent / cap) * 100);
  const over = spent > cap;

  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold text-muted-foreground">
          {t("budgetLabel")}
        </span>
        <span
          className={cn(
            "font-mono text-sm font-bold tabular-nums",
            over ? "text-red-400" : "text-foreground"
          )}
        >
          ${spent}{" "}
          <span className="text-xs font-normal text-muted-foreground">
            / ${cap}
          </span>
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            over ? "bg-red-500" : pct >= 85 ? "bg-amber-400" : "bg-primary"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

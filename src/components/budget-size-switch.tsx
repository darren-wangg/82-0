"use client";

/**
 * The 6 / 8 roster-size selector for Budget mode. Mirrors the home screen's
 * TeamSizeSwitch (same compact segmented control) but writes the budget-size
 * session cookie and refreshes so the server-rendered selector re-reads the
 * size-appropriate caps and the (budget) layout mounts the matching mode.
 */

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  BUDGET_SIZE_COOKIE,
  BUDGET_SIZES,
  type BudgetSize,
} from "@/lib/budget";
import { cn } from "@/lib/utils";

/** Session cookie (no max-age): readable server-side, shared across tabs. */
function persistBudgetSize(size: BudgetSize): void {
  document.cookie = `${BUDGET_SIZE_COOKIE}=${size}; path=/; samesite=lax`;
}

export function BudgetSizeSwitch({
  value,
  className,
}: {
  value: BudgetSize;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const select = (size: BudgetSize) => {
    if (size === value || pending) return;
    persistBudgetSize(size);
    startTransition(() => router.refresh());
  };

  return (
    <div
      role="group"
      aria-label="Roster size"
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 rounded-lg bg-muted/60 p-0.5",
        pending && "opacity-70",
        className
      )}
    >
      {BUDGET_SIZES.map((size) => {
        const active = size === value;
        return (
          <button
            key={size}
            type="button"
            aria-pressed={active}
            disabled={pending}
            onClick={() => select(size)}
            className={cn(
              "relative z-10 h-10 min-w-12 rounded-md px-4 text-md font-bold tabular-nums transition-colors duration-200",
              active
                ? "text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {active && (
              <motion.span
                layoutId="budget-size-indicator"
                className="absolute inset-0 rounded-md bg-primary shadow"
                transition={{ type: "spring", stiffness: 500, damping: 32 }}
              />
            )}
            <span className="relative">{size}</span>
          </button>
        );
      })}
    </div>
  );
}

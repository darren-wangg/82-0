"use client";

/**
 * The 5 / 8 / 10 team-size selector. Writes the choice to a session cookie and
 * refreshes so every server-rendered surface (home Start Draft target, the
 * leaderboard/lobbies lists) re-reads it; client lists (My Teams) get the new
 * value as a refreshed prop. Lives on the home screen and to the right of each
 * social page's header. Kept minimal: a compact segmented control.
 */

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { TEAM_SIZES, TEAM_SIZE_COOKIE, type TeamSize } from "@/lib/team-size";
import { cn } from "@/lib/utils";

/** Session cookie (no max-age): persists for the browser session, shared across
 *  tabs, readable server-side. Module-level so the write isn't flagged as a
 *  render-body mutation. */
function persistTeamSize(size: TeamSize): void {
  document.cookie = `${TEAM_SIZE_COOKIE}=${size}; path=/; samesite=lax`;
}

export function TeamSizeSwitch({
  value,
  className,
}: {
  value: TeamSize;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const select = (size: TeamSize) => {
    if (size === value || pending) return;
    persistTeamSize(size);
    startTransition(() => router.refresh());
  };

  return (
    <div
      role="group"
      aria-label="Team size"
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 rounded-lg bg-muted/60 p-0.5",
        pending && "opacity-70",
        className
      )}
    >
      {TEAM_SIZES.map((size) => {
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
                layoutId="team-size-indicator"
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

"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { mulberry32 } from "./draft-state";

const ROW_H = 56; // px — one reel row

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * One slot-machine reel. When `value` changes (per spin/skip) it rolls through
 * filler labels and settles on the value; `value === null` shows an idle row.
 * Purely visual — the result is already decided by the reducer.
 */
export function SlotReel({
  value,
  items,
  nonce,
  duration = 1.3,
  delay = 0,
  idleLabel = "— — —",
  className,
  rowClassName,
}: {
  value: string | null;
  /** Filler labels to roll through (the full set of possibilities). */
  items: string[];
  /** Spin nonce — varies the filler sequence between spins. */
  nonce: number;
  duration?: number;
  delay?: number;
  idleLabel?: string;
  className?: string;
  rowClassName?: string;
}) {
  const rows = useMemo(() => {
    if (value === null) return null;
    const rng = mulberry32((hashString(value) ^ Math.imul(nonce + 1, 2654435761)) >>> 0);
    const fillers = items.filter((i) => i !== value);
    const count = Math.min(14, Math.max(6, fillers.length));
    const picked =
      fillers.length === 0
        ? []
        : Array.from({ length: count }, () => fillers[Math.floor(rng() * fillers.length)]);
    return [...picked, value];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, items]); // deliberately NOT nonce: an unchanged axis must not re-roll

  return (
    <div
      className={cn("relative overflow-hidden", className)}
      style={{ height: ROW_H }}
      aria-live="polite"
    >
      {rows === null ? (
        <div
          className={cn(
            "flex items-center justify-center font-bold text-muted-foreground/40",
            rowClassName
          )}
          style={{ height: ROW_H }}
        >
          {idleLabel}
        </div>
      ) : (
        <motion.div
          key={value}
          initial={{ y: 0 }}
          animate={{ y: -(rows.length - 1) * ROW_H }}
          transition={{ duration, delay, ease: [0.12, 0.75, 0.2, 1] }}
        >
          {rows.map((label, i) => (
            <div
              key={i}
              className={cn("flex items-center justify-center", rowClassName)}
              style={{ height: ROW_H }}
            >
              {label}
            </div>
          ))}
        </motion.div>
      )}
      {/* fade masks for the slot window */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-3 bg-gradient-to-b from-card to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3 bg-gradient-to-t from-card to-transparent" />
    </div>
  );
}

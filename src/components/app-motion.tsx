"use client";

/**
 * App-wide Framer Motion config: `reducedMotion="user"` disables transform
 * and layout animations (reels, springs, pulses) for visitors with
 * prefers-reduced-motion, while opacity transitions still run. Children stay
 * server components — only the context provider is client-side.
 */

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

export function AppMotion({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

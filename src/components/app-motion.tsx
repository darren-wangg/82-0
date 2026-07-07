"use client";

/**
 * App-wide Framer Motion config.
 *
 * LazyMotion: components render `m.*` (not `motion.*`), so the animation
 * runtime isn't compiled into every route-group bundle — the domMax feature
 * bundle loads once, async, off the critical path. `strict` throws on any
 * stray `motion.*` usage so the full runtime can't sneak back in.
 *
 * MotionConfig: `reducedMotion="user"` disables transform and layout
 * animations (reels, springs, pulses) for visitors with
 * prefers-reduced-motion, while opacity transitions still run.
 *
 * Children stay server components — only the context providers are client-side.
 */

import { LazyMotion, MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

const loadFeatures = () =>
  import("./motion-features").then((mod) => mod.default);

export function AppMotion({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}

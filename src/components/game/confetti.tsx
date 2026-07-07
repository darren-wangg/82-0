"use client";

/**
 * One-shot confetti burst for the perfect 82-0 season. Pure Framer Motion —
 * no extra dependency. Piece geometry comes from a seeded PRNG at module
 * scope, so rendering stays pure (and every 82-0 gets the same shower).
 * Callers must gate behind useReducedMotion themselves.
 */

import { m } from "framer-motion";
import { mulberry32 } from "./draft-state";

const COLORS = [
  "bg-primary",
  "bg-amber-300",
  "bg-emerald-400",
  "bg-violet-400",
  "bg-sky-400",
];

/** Pieces in the opening burst (the minimal variant slices from these). */
const BURST_COUNT = 80;
/** Extra pieces that keep raining after the burst — full showers only. */
const RAIN_COUNT = 120;
const PIECE_COUNT = BURST_COUNT + RAIN_COUNT;

interface Piece {
  left: number; // % across the viewport
  size: number; // px
  color: string;
  /** Some pieces fall as 🏀 instead of a colored rectangle. */
  ball: boolean;
  delay: number; // s, relative to the burst start
  duration: number;
  drift: number; // px of horizontal sway
  spin: number; // degrees
}

const PIECES: Piece[] = (() => {
  const rand = mulberry32(820);
  const piece = (delay: number): Piece => ({
    left: rand() * 100,
    size: 5 + rand() * 6,
    color: COLORS[Math.floor(rand() * COLORS.length)],
    ball: rand() < 0.12,
    delay,
    duration: 2.4 + rand() * 1.6,
    drift: (rand() - 0.5) * 140,
    spin: 360 + rand() * 540,
  });
  return [
    // dense opening burst…
    ...Array.from({ length: BURST_COUNT }, () => piece(rand() * 0.8)),
    // …then a sustained rain so an 82-0 keeps celebrating
    ...Array.from({ length: RAIN_COUNT }, () => piece(0.6 + rand() * 3.4)),
  ];
})();

export function Confetti({
  delay = 0,
  pieces = PIECE_COUNT,
}: {
  delay?: number;
  /** Fewer pieces = the "minimal" variant (e.g. a legendary pull). */
  pieces?: number;
}) {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-40 overflow-hidden"
    >
      {PIECES.slice(0, pieces).map((p, i) => (
        <m.span
          key={i}
          className={
            p.ball
              ? "absolute top-0 leading-none"
              : `absolute top-0 rounded-[2px] ${p.color}`
          }
          style={
            p.ball
              ? { left: `${p.left}%`, fontSize: p.size * 2.2 }
              : { left: `${p.left}%`, width: p.size, height: p.size * 0.45 }
          }
          initial={{ y: "-5vh", x: 0, rotate: 0, opacity: 1 }}
          animate={{
            y: "105vh",
            x: [0, p.drift, -p.drift * 0.6, p.drift * 0.3],
            rotate: p.spin,
            opacity: [1, 1, 1, 0.9],
          }}
          transition={{
            delay: delay + p.delay,
            duration: p.duration,
            ease: [0.2, 0.4, 0.6, 1],
          }}
        >
          {p.ball ? "🏀" : null}
        </m.span>
      ))}
    </div>
  );
}

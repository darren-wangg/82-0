"use client";

/**
 * One-shot confetti burst for the perfect 82-0 season. Pure Framer Motion —
 * no extra dependency. Piece geometry comes from a seeded PRNG at module
 * scope, so rendering stays pure (and every 82-0 gets the same shower).
 * Callers must gate behind useReducedMotion themselves.
 */

import { motion } from "framer-motion";
import { mulberry32 } from "./draft-state";

const COLORS = [
  "bg-primary",
  "bg-amber-300",
  "bg-emerald-400",
  "bg-violet-400",
  "bg-sky-400",
];

const PIECE_COUNT = 60;

interface Piece {
  left: number; // % across the viewport
  size: number; // px
  color: string;
  delay: number; // s, relative to the burst start
  duration: number;
  drift: number; // px of horizontal sway
  spin: number; // degrees
}

const PIECES: Piece[] = (() => {
  const rand = mulberry32(820);
  return Array.from({ length: PIECE_COUNT }, () => ({
    left: rand() * 100,
    size: 5 + rand() * 5,
    color: COLORS[Math.floor(rand() * COLORS.length)],
    delay: rand() * 0.8,
    duration: 2.4 + rand() * 1.6,
    drift: (rand() - 0.5) * 120,
    spin: 360 + rand() * 540,
  }));
})();

export function Confetti({ delay = 0 }: { delay?: number }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-40 overflow-hidden"
    >
      {PIECES.map((p, i) => (
        <motion.span
          key={i}
          className={`absolute top-0 rounded-[2px] ${p.color}`}
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.45,
          }}
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
        />
      ))}
    </div>
  );
}

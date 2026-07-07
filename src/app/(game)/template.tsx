"use client";

import type { ReactNode } from "react";
import { m } from "framer-motion";

/**
 * Re-mounts on every navigation inside the game group, giving /play ↔ /sim
 * a quick fade-and-rise transition instead of an abrupt swap. GameProvider
 * lives in the layout above, so game state survives the re-mount.
 */
export default function GameTemplate({ children }: { children: ReactNode }) {
  return (
    <m.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex flex-1 flex-col"
    >
      {children}
    </m.div>
  );
}

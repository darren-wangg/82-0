"use client";

/**
 * One-shot confetti + basketball shower on the closed lobby page — the same
 * celebration a perfect 82-0 season gets. Fires once per lobby per tab (a
 * sessionStorage flag) so landing on the crowned view celebrates, but a manual
 * refresh doesn't loop it. Gated on useReducedMotion, like every Confetti caller.
 */

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Confetti } from "@/components/game/confetti";

export function LobbyCelebration({ code }: { code: string }) {
  const reducedMotion = useReducedMotion();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (reducedMotion) return;
    const key = `ud:lobby-celebrated:${code}`;
    try {
      if (sessionStorage.getItem(key) === "1") return;
      sessionStorage.setItem(key, "1");
    } catch {
      // sessionStorage unavailable — still celebrate this once.
    }
    // Defer the setState out of the effect body (post-hydration kickoff).
    const id = window.setTimeout(() => setShow(true), 0);
    return () => window.clearTimeout(id);
  }, [code, reducedMotion]);

  return show ? <Confetti /> : null;
}

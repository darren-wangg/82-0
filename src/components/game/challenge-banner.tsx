"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Swords } from "lucide-react";
import type { SavedTeam } from "@/lib/contracts";

/**
 * Compact banner shown while drafting against a saved team. Fetches the
 * target's name and record; renders nothing until (and unless) that works —
 * the challenge itself still completes from the slug alone.
 */
export function ChallengeBanner({ slug }: { slug: string }) {
  const [team, setTeam] = useState<SavedTeam | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/teams/${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((t: SavedTeam | null) => {
        if (!cancelled && t) setTeam(t);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (!team) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-2 flex items-center gap-2 rounded-lg border border-violet-400/40 bg-violet-400/10 px-2.5 py-1.5 text-xs"
    >
      <Swords className="size-3.5 shrink-0 text-violet-300" />
      <span className="min-w-0 truncate">
        Challenge: beat{" "}
        <span className="font-bold text-violet-300">{team.teamName}</span>
      </span>
      <span className="ml-auto shrink-0 font-mono font-bold text-violet-300">
        {team.season.wins}-{team.season.losses}
      </span>
    </motion.div>
  );
}

import type { Decade, NineCat, PlayerStatLine } from "@/lib/contracts";

export const CAT_LABELS: Record<NineCat, string> = {
  pts: "PTS",
  reb: "REB",
  ast: "AST",
  stl: "STL",
  blk: "BLK",
  fgPct: "FG%",
  ftPct: "FT%",
  tpm: "3PM",
  tov: "TOV",
};

/** Friendly names for gate callouts ("Turnovers capped you at N wins"). */
export const CAT_FRIENDLY: Record<NineCat, string> = {
  pts: "Scoring",
  reb: "Rebounding",
  ast: "Playmaking",
  stl: "Steals",
  blk: "Rim protection",
  fgPct: "Field-goal shooting",
  ftPct: "Free-throw shooting",
  tpm: "Three-point shooting",
  tov: "Turnovers",
};

export function formatCatValue(cat: NineCat, value: number): string {
  if (cat === "fgPct" || cat === "ftPct") return `${(value * 100).toFixed(1)}%`;
  return value.toFixed(1);
}

export function isEstimated(player: PlayerStatLine, cat: NineCat): boolean {
  return player.estimatedCats.includes(cat);
}

/** Last name fallback when a player has no curated nickname. */
export function displayNickname(player: PlayerStatLine): string {
  return player.nickname ?? player.name.split(" ").slice(-1)[0];
}

/** Sortable categories for the pool list dropdown. */
export const SORT_OPTIONS: { cat: NineCat; label: string }[] = [
  { cat: "pts", label: "PPG" },
  { cat: "reb", label: "RPG" },
  { cat: "ast", label: "APG" },
  { cat: "tpm", label: "3PG" },
  { cat: "stl", label: "STL" },
  { cat: "blk", label: "BLK" },
];

/** A color identity per decade, used on chips and the era reel. */
export const DECADE_COLORS: Record<Decade, { text: string; chip: string }> = {
  "1960s": { text: "text-amber-400", chip: "border-amber-400/40 bg-amber-400/15 text-amber-300" },
  "1970s": { text: "text-orange-400", chip: "border-orange-400/40 bg-orange-400/15 text-orange-300" },
  "1980s": { text: "text-pink-400", chip: "border-pink-400/40 bg-pink-400/15 text-pink-300" },
  "1990s": { text: "text-red-400", chip: "border-red-400/40 bg-red-400/15 text-red-300" },
  "2000s": { text: "text-sky-400", chip: "border-sky-400/40 bg-sky-400/15 text-sky-300" },
  "2010s": { text: "text-violet-400", chip: "border-violet-400/40 bg-violet-400/15 text-violet-300" },
  "2020s": { text: "text-emerald-400", chip: "border-emerald-400/40 bg-emerald-400/15 text-emerald-300" },
};

/** Running per-game averages over drafted players (the only stats shown
 *  during the draft — no engine breakdown until the season simulates). */
export function teamAverages(
  players: PlayerStatLine[]
): { label: string; value: string }[] {
  const cats = ["pts", "reb", "ast", "stl", "blk", "tov"] as const;
  const labels: Record<(typeof cats)[number], string> = {
    pts: "PPG",
    reb: "RPG",
    ast: "APG",
    stl: "SPG",
    blk: "BPG",
    tov: "TO",
  };
  return cats.map((cat) => ({
    label: labels[cat],
    value:
      players.length === 0
        ? "—"
        : (
            players.reduce((sum, p) => sum + p.stats[cat], 0) / players.length
          ).toFixed(1),
  }));
}

import type { NineCat, PlayerStatLine } from "@/lib/contracts";

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

/**
 * Prompt builders for AI explanations. Fed ONLY structured engine output —
 * never raw user text beyond team names. Pure functions; the payload types
 * double as the content-hash input (see explanationContentHash).
 *
 * Bump PROMPT_VERSION whenever prompt wording changes so cached explanations
 * are regenerated.
 */

import {
  MatchupResult,
  NineCat,
  SeasonResult,
  TeamRating,
} from "@/lib/contracts";

export const PROMPT_VERSION = "v1";
export const EXPLAIN_MODEL = "claude-sonnet-4-6";

export const CAT_LABELS: Record<NineCat, string> = {
  pts: "points",
  reb: "rebounds",
  ast: "assists",
  stl: "steals",
  blk: "blocks",
  fgPct: "field-goal %",
  ftPct: "free-throw %",
  tpm: "threes made",
  tov: "turnovers",
};

export interface TeamExplainPayload {
  teamName: string;
  players: { name: string; era: string; position: string; bench: boolean }[];
  rating: TeamRating;
  season: SeasonResult;
}

export interface MatchupExplainPayload {
  teamA: { teamName: string; rating: TeamRating };
  teamB: { teamName: string; rating: TeamRating };
  result: MatchupResult;
}

const SYSTEM_PROMPT =
  "You are a sharp, fun NBA analyst for a fantasy draft game where users build " +
  "8-player all-time rosters that get simulated. Category values are " +
  "era-adjusted z-scores (higher is always better, including turnovers which " +
  "are sign-flipped). Be concrete and reference the numbers you are given. " +
  "Never invent stats that are not in the data. Plain text only, no markdown headings.";

export function buildTeamSystemPrompt(): string {
  return SYSTEM_PROMPT;
}

export function buildTeamPrompt(payload: TeamExplainPayload): string {
  const { teamName, players, rating, season } = payload;
  const starters = players.filter((p) => !p.bench);
  const bench = players.filter((p) => p.bench);
  const cats = (Object.entries(rating.catProfile) as [NineCat, number][])
    .map(([cat, v]) => `${CAT_LABELS[cat]}: ${v.toFixed(2)}`)
    .join(", ");

  return [
    `Analyze this all-time fantasy roster in exactly 3 short paragraphs:`,
    `1) The team's biggest strengths.`,
    `2) The weakness capping its record${
      season.gatedCategory
        ? ` — the binding gate is ${CAT_LABELS[season.gatedCategory]} (win cap ${season.winCap})`
        : " — note that no category gate applied (win cap 82)"
    }.`,
    `3) One concrete improvement (which kind of player to swap in, and where).`,
    ``,
    `Team: "${teamName}"`,
    `Projected record: ${season.wins}-${season.losses}`,
    `Ratings: OVR ${rating.ovr.toFixed(1)}, OFF ${rating.offRating.toFixed(1)}, DEF ${rating.defRating.toFixed(1)}`,
    `Starters: ${starters.map((p) => `${p.name} (${p.position}, ${p.era})`).join("; ")}`,
    `Bench: ${bench.map((p) => `${p.name} (${p.position}, ${p.era})`).join("; ")}`,
    `Category profile (era-adjusted, higher is better): ${cats}`,
  ].join("\n");
}

export function buildMatchupSystemPrompt(): string {
  return SYSTEM_PROMPT;
}

export function buildMatchupPrompt(payload: MatchupExplainPayload): string {
  const { teamA, teamB, result } = payload;
  const winner = result.winner === "A" ? teamA.teamName : teamB.teamName;
  const loser = result.winner === "A" ? teamB.teamName : teamA.teamName;
  const breakdown = result.catBreakdown
    .map(
      (e) =>
        `${CAT_LABELS[e.cat]}: ${teamA.teamName} ${e.teamA.toFixed(2)} vs ${teamB.teamName} ${e.teamB.toFixed(2)} (edge ${e.edge >= 0 ? "+" : ""}${e.edge.toFixed(2)} to ${e.edge >= 0 ? teamA.teamName : teamB.teamName})`
    )
    .join("\n");

  return [
    `Write a punchy 2-paragraph recap of a simulated best-of-7 series explaining why the winner won.`,
    `Lead with the result, then use the category edges to explain it. Keep it under 150 words.`,
    ``,
    `Matchup: "${teamA.teamName}" (OVR ${teamA.rating.ovr.toFixed(1)}) vs "${teamB.teamName}" (OVR ${teamB.rating.ovr.toFixed(1)})`,
    `Winner: "${winner}" over "${loser}", series ${result.seriesScore[0]}-${result.seriesScore[1]} (score is teamA-teamB)`,
    `Per-game win probability for ${teamA.teamName}: ${(result.pGameA * 100).toFixed(0)}%`,
    `Category edges (era-adjusted z-scores, higher is better):`,
    breakdown,
  ].join("\n");
}

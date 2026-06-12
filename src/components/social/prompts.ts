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

export const PROMPT_VERSION = "v3";
/** Cheapest tier — explanations are short, structured-input blurbs. */
export const EXPLAIN_MODEL = "claude-haiku-4-5-20251001";

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
  "You are a sharp veteran NBA scout filing quick evaluations for a fantasy " +
  "game where people draft 8-player all-time rosters that get simulated. " +
  "Write like a great color commentator: dry, confident, specific — wit " +
  "comes from basketball insight, never from forced slang, catchphrases, or " +
  "hype. Keep it conversational and direct; one cutting observation beats " +
  "three jokes. Ground every claim in the numbers you're given: category " +
  "values are era-adjusted z-scores (higher is always better; turnovers are " +
  "sign-flipped). Never invent stats. Plain text only — no markdown, " +
  "headings, or bullet points. Hard limit: 3 sentences, no exceptions.";

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
    `Give your read on this roster in AT MOST 3 sentences:`,
    `what makes it work, what's holding it back${
      season.gatedCategory
        ? ` (the binding weakness is ${CAT_LABELS[season.gatedCategory]} — it capped them at ${season.winCap} wins, call it out)`
        : " (no category gate applied — nothing capped them)"
    }, and the one fix you'd make.`,
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
    `Recap this simulated best-of-7 in AT MOST 3 sentences.`,
    `Lead with how decisive (or close) it was, then point at the category edges that decided it.`,
    ``,
    `Matchup: "${teamA.teamName}" (OVR ${teamA.rating.ovr.toFixed(1)}) vs "${teamB.teamName}" (OVR ${teamB.rating.ovr.toFixed(1)})`,
    `Winner: "${winner}" over "${loser}", series ${result.seriesScore[0]}-${result.seriesScore[1]} (score is teamA-teamB)`,
    `Per-game win probability for ${teamA.teamName}: ${(result.pGameA * 100).toFixed(0)}%`,
    `Category edges (era-adjusted z-scores, higher is better):`,
    breakdown,
  ].join("\n");
}

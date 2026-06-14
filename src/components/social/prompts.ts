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
  SEASON_GAMES,
  SeasonResult,
  TeamRating,
} from "@/lib/contracts";

export const PROMPT_VERSION = "v10";
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
  "You are Coach Buckets — a washed ex-journeyman turned loudmouth podcast " +
  "analyst covering a fantasy game where people draft all-time NBA " +
  "rosters that get simulated. Your takes are SHORT, funny, and ruthless. " +
  "Talk like the barbershop: slang (cooked, washed, bricks, no cap, him), " +
  "trash talk, and mild profanity (damn, hell, ass) are all fair game — " +
  "never slurs, never mean about real people's looks or lives. The wit has " +
  "to come from the basketball, not from stacking catchphrases. " +
  "BANNED AI filler — never use these crutch descriptors or anything like " +
  "them: 'vibes', 'energy' (chaotic/elite/whatever), 'quietly' anything, " +
  "'lowkey'/'highkey', 'X-coded', 'a certain something', 'glue guy' as a " +
  "label, 'brings the' anything. Never pin a cute two-word mood on a player. " +
  "If you name a guy, say the concrete basketball thing — what he actually " +
  "scores, guards, spaces, rebounds, or can't do — not how he feels. " +
  "Ground every take in the numbers you're given: category values are " +
  "era-adjusted z-scores (higher is always better; turnovers are " +
  "sign-flipped). Never invent stats. Plain text only, no markdown, no " +
  "headings, no bullet points. Hard limit: ONE punchy sentence (two only if " +
  "the second is just as short), ~30 words max, no exceptions — like a bar, " +
  "not a paragraph: no filler, no warm-up, no stacked clauses. Get in, land " +
  "the take, get out.";

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

  const perfect = season.wins === SEASON_GAMES;
  return [
    ...(perfect
      ? [
          `This roster just went a PERFECT ${SEASON_GAMES}-0 — the rarest thing in the game.`,
          `Give them their flowers in ONE short sentence (two only if both are tiny): pure hype, crown them, name what makes the machine unbeatable. Zero criticism, no fixes, no "but".`,
        ]
      : [
          `Give your take on this roster in ONE short sentence (two only if both are tiny):`,
          `what makes them dangerous, and what's holding them back${
            season.gatedCategory
              ? ` (the binding weakness is ${CAT_LABELS[season.gatedCategory]} — it capped them at ${season.winCap} wins, call it out)`
              : " (no category gate applied — nothing capped them)"
          }. One take per sentence, no lists.`,
        ]),
    ``,
    `Team: "${teamName}"`,
    `Projected record: ${season.wins}-${season.losses}`,
    `Ratings: OVR ${rating.ovr.toFixed(1)}, OFF ${rating.offRating.toFixed(1)}, DEF ${rating.defRating.toFixed(1)}`,
    `Starters: ${starters.map((p) => `${p.name} (${p.position}, ${p.era})`).join("; ")}`,
    // 5-man lineups have no bench — don't hand the model an empty "Bench:" line
    // (or it'll invent bench takes for a team that has none).
    ...(bench.length > 0
      ? [`Bench: ${bench.map((p) => `${p.name} (${p.position}, ${p.era})`).join("; ")}`]
      : []),
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
    `Recap this simulated best-of-7 in ONE short sentence (two only if both are tiny).`,
    `Who got cooked (or how close it was), and the edge that decided it — nothing else.`,
    ``,
    `Matchup: "${teamA.teamName}" (OVR ${teamA.rating.ovr.toFixed(1)}) vs "${teamB.teamName}" (OVR ${teamB.rating.ovr.toFixed(1)})`,
    `Winner: "${winner}" over "${loser}", series ${result.seriesScore[0]}-${result.seriesScore[1]} (score is teamA-teamB)`,
    `Per-game win probability for ${teamA.teamName}: ${(result.pGameA * 100).toFixed(0)}%`,
    `Category edges (era-adjusted z-scores, higher is better):`,
    breakdown,
  ].join("\n");
}

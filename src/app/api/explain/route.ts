/**
 * POST /api/explain — streaming AI explanations (Vercel AI SDK + Claude).
 *
 * The prompt is built ONLY from structured engine output. Explanations are
 * cached by content hash: sha256(kind + canonical JSON payload + prompt
 * version), checked before calling the model and persisted on completion.
 * Returns a plain text stream; 503 JSON when ANTHROPIC_API_KEY is unset.
 */

import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import {
  ExplainRequestSchema,
  MatchupResult,
  Roster,
  RosterSchema,
  TeamRating,
} from "@/lib/contracts";
import { prisma } from "@/lib/db";
import { getEngine } from "@/lib/engine-provider";
import { getBaselines, getPlayerMap, getSnapshot } from "@/lib/snapshot";
import { validateRoster } from "@/components/social/validation";
import { explanationContentHash } from "@/components/social/hashing";
import {
  buildMatchupPrompt,
  buildMatchupSystemPrompt,
  buildTeamPrompt,
  buildTeamSystemPrompt,
  EXPLAIN_MODEL,
  MatchupExplainPayload,
  PROMPT_VERSION,
  TeamExplainPayload,
} from "@/components/social/prompts";
import {
  isDbUnavailable,
  jsonError,
  findTeamBySlug,
  ratingFromRow,
  TeamWithOwner,
} from "../_lib/teams";
import { checkRateLimit, RATE_LIMITS, rateLimitGate } from "../_lib/rate-limit";

const TEXT_STREAM_HEADERS = {
  "content-type": "text/plain; charset=utf-8",
} as const;

function payloadFromRoster(
  teamName: string,
  roster: Roster,
  rating: TeamRating
): TeamExplainPayload {
  const season = getEngine().projectSeason(rating);
  const players = getPlayerMap();

  const describe = (id: string, bench: boolean) => {
    const p = players.get(id);
    return p
      ? { name: p.name, era: p.decade, position: p.position, bench }
      : { name: id, era: "unknown", position: "?", bench };
  };

  return {
    teamName,
    players: [
      ...Object.values(roster.starters).map((id) => describe(id, false)),
      ...roster.bench.map((id) => describe(id, true)),
    ],
    rating,
    season,
  };
}

function buildTeamPayload(team: TeamWithOwner): TeamExplainPayload {
  return payloadFromRoster(
    team.teamName,
    RosterSchema.parse(team.roster),
    ratingFromRow(team)
  );
}

export async function POST(request: Request) {
  const limited = await rateLimitGate(request, RATE_LIMITS.explain);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Request body must be JSON");
  }

  const parsed = ExplainRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid request");
  }
  const req = parsed.data;

  // 1. Load the engine outputs the explanation will describe.
  let kind: "team" | "matchup";
  let payload: TeamExplainPayload | MatchupExplainPayload;
  let system: string;
  let prompt: string;

  try {
    if (req.kind === "team") {
      const team = await findTeamBySlug(req.teamSlug);
      if (!team) return jsonError(404, "Team not found");
      kind = "team";
      const teamPayload = buildTeamPayload(team);
      payload = teamPayload;
      system = buildTeamSystemPrompt();
      prompt = buildTeamPrompt(teamPayload);
    } else if (req.kind === "draft") {
      // Unsaved roster from /sim — no DB row; re-run the engine server-side.
      if (req.snapshotVersion !== getSnapshot().version) {
        return jsonError(422, "Snapshot version mismatch — refresh and redraft");
      }
      const players = getPlayerMap();
      const valid = validateRoster(req.roster, players);
      if (!valid.ok) return jsonError(422, valid.error);
      const rating = getEngine().teamRating(req.roster, players, getBaselines());
      kind = "team";
      // Constant name: identical rosters share one cache entry pre- and
      // post-naming would not (the saved variant hashes the real team name).
      const teamPayload = payloadFromRoster("This draft", req.roster, rating);
      payload = teamPayload;
      system = buildTeamSystemPrompt();
      prompt = buildTeamPrompt(teamPayload);
    } else {
      const matchup = await prisma.matchup.findUnique({
        where: { id: req.matchupId },
        include: { teamA: true, teamB: true },
      });
      if (!matchup) return jsonError(404, "Matchup not found");
      kind = "matchup";
      const matchupPayload: MatchupExplainPayload = {
        teamA: {
          teamName: matchup.teamA.teamName,
          rating: ratingFromRow({ ...matchup.teamA, user: null }),
        },
        teamB: {
          teamName: matchup.teamB.teamName,
          rating: ratingFromRow({ ...matchup.teamB, user: null }),
        },
        result: matchup.result as unknown as MatchupResult,
      };
      payload = matchupPayload;
      system = buildMatchupSystemPrompt();
      prompt = buildMatchupPrompt(matchupPayload);
    }
  } catch (err) {
    if (isDbUnavailable(err)) {
      return jsonError(503, "Explanations are temporarily unavailable");
    }
    throw err;
  }

  // 2. Cache check (best-effort — a cache failure never blocks generation).
  const contentHash = explanationContentHash(kind, payload, PROMPT_VERSION);
  try {
    const cached = await prisma.explanation.findUnique({ where: { contentHash } });
    if (cached) {
      return new Response(cached.text, {
        headers: { ...TEXT_STREAM_HEADERS, "x-explain-cache": "hit" },
      });
    }
  } catch {
    // No DB / cache miss path — fall through to generation.
  }

  // 3. Generate.
  if (!process.env.ANTHROPIC_API_KEY) {
    return jsonError(
      503,
      "AI explanations are not configured (ANTHROPIC_API_KEY is not set)"
    );
  }

  // App-level spend ceiling: only uncached generations reach this point, and
  // a global daily budget bounds worst-case model spend no matter how many
  // unique rosters a script invents.
  const budget = await checkRateLimit(RATE_LIMITS.explainGenerationDaily, "global");
  if (!budget.ok) {
    return jsonError(503, "The scouting desk is slammed today — check back tomorrow");
  }

  const result = streamText({
    model: anthropic(EXPLAIN_MODEL),
    system,
    prompt,
    onFinish: async ({ text }) => {
      try {
        await prisma.explanation.upsert({
          where: { contentHash },
          create: { contentHash, kind, text, model: EXPLAIN_MODEL },
          update: {},
        });
      } catch {
        // Persisting the cache is best-effort.
      }
    },
  });

  return result.toTextStreamResponse({
    headers: { "x-explain-cache": "miss" },
  });
}

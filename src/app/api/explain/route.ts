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
import { z } from "zod";
import {
  ExplainRequest,
  MatchupResult,
  POSITIONS,
  Roster,
  TeamRating,
} from "@/lib/contracts";
import { ExplainRequestSchema } from "@/lib/contracts-schemas";
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
  FlexibleRosterSchema,
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

/**
 * Route-local schema for an unsaved-draft explanation. The frozen
 * ExplainRequestSchema's "draft" kind pins the bench to the 8-man roster; this
 * accepts every size's bench too (0–5). It only feeds the engine + prompt
 * (never persisted as a team), so it stays off the frozen contract. Bench
 * order is the mode's convention; the engine is bench-count agnostic.
 */
const DraftExplainSchema = z.object({
  kind: z.literal("draft"),
  roster: z.object({
    starters: z.record(z.enum(POSITIONS), z.string()),
    bench: z.array(z.string()).min(0).max(5),
  }),
  snapshotVersion: z.string(),
  // Optional coarse "drafter profile" blurb (client-derived from past drafts).
  // Bounded so it can't bloat the prompt; folded into the explanation hash via
  // the payload so distinct profiles get distinct cache entries.
  playerProfile: z.string().max(200).optional(),
});

/** In-flight generations by content hash (per instance): concurrent first
 *  views of the same team wait for one Claude call instead of each paying
 *  for their own. */
const inFlight = new Map<string, Promise<string>>();

function payloadFromRoster(
  teamName: string,
  roster: Roster,
  rating: TeamRating,
  drafterProfile?: string
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
    ...(drafterProfile ? { drafterProfile } : {}),
  };
}

function buildTeamPayload(team: TeamWithOwner): TeamExplainPayload {
  // Flexible parse: saved teams can be 5-man (0 bench) or 10-man (5 bench), not
  // just the frozen RosterSchema's 8-man (3 bench). The engine and the prompt
  // builder are both bench-count agnostic.
  return payloadFromRoster(
    team.teamName,
    FlexibleRosterSchema.parse(team.roster),
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

  // Drafts (any size's bench, 0–5) parse with a route-local schema; saved
  // teams and matchups use the frozen contract schema.
  const isDraft = (body as { kind?: unknown } | null)?.kind === "draft";
  let draftReq: z.infer<typeof DraftExplainSchema> | null = null;
  let req: ExplainRequest | null = null;
  if (isDraft) {
    const parsed = DraftExplainSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid request");
    }
    draftReq = parsed.data;
  } else {
    const parsed = ExplainRequestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid request");
    }
    req = parsed.data;
  }

  // 1. Load the engine outputs the explanation will describe.
  let kind: "team" | "matchup";
  let payload: TeamExplainPayload | MatchupExplainPayload;
  let system: string;
  let prompt: string;

  try {
    if (draftReq) {
      // Unsaved roster from /sim — no DB row; re-run the engine server-side.
      if (draftReq.snapshotVersion !== getSnapshot().version) {
        return jsonError(422, "Snapshot version mismatch — refresh and redraft");
      }
      const players = getPlayerMap();
      const roster = draftReq.roster as Roster;
      const valid = validateRoster(roster, players, { benchCounts: [0, 1, 3, 5] });
      if (!valid.ok) return jsonError(422, valid.error);
      const rating = getEngine().teamRating(roster, players, getBaselines());
      kind = "team";
      // Constant name: identical rosters share one cache entry; the saved
      // variant hashes the real team name instead. The coarse drafter profile
      // (when sent) further partitions the cache, but only into a few buckets.
      const teamPayload = payloadFromRoster(
        "This draft",
        roster,
        rating,
        draftReq.playerProfile
      );
      payload = teamPayload;
      system = buildTeamSystemPrompt();
      prompt = buildTeamPrompt(teamPayload);
    } else if (req!.kind === "team") {
      const team = await findTeamBySlug(req!.teamSlug);
      if (!team) return jsonError(404, "Team not found");
      kind = "team";
      const teamPayload = buildTeamPayload(team);
      payload = teamPayload;
      system = buildTeamSystemPrompt();
      prompt = buildTeamPrompt(teamPayload);
    } else if (req!.kind === "matchup") {
      const matchup = await prisma.matchup.findUnique({
        where: { id: req!.matchupId },
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
    } else {
      // Unreachable: a "draft" kind is handled by draftReq above.
      return jsonError(400, "Invalid request");
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

  // A generation for this exact content is already running — wait for its
  // text instead of paying for a duplicate Claude call.
  const pending = inFlight.get(contentHash);
  if (pending) {
    try {
      const text = await pending;
      return new Response(text, {
        headers: { ...TEXT_STREAM_HEADERS, "x-explain-cache": "joined" },
      });
    } catch {
      return jsonError(503, "Explanations are temporarily unavailable");
    }
  }

  // App-level spend ceiling: only uncached generations reach this point, and
  // a global daily budget bounds worst-case model spend no matter how many
  // unique rosters a script invents. Fails CLOSED: no DB = no accounting =
  // no generation.
  const budget = await checkRateLimit(
    RATE_LIMITS.explainGenerationDaily,
    "global",
    { failOpen: false }
  );
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

  // result.text resolves with the full output (the AI SDK tees the stream).
  const textPromise = Promise.resolve(result.text);
  inFlight.set(contentHash, textPromise);
  textPromise.catch(() => {}).finally(() => inFlight.delete(contentHash));

  return result.toTextStreamResponse({
    headers: { "x-explain-cache": "miss" },
  });
}

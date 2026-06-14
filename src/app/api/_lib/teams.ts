/**
 * Server-side service layer shared by API route handlers and (social) pages.
 * All engine access goes through getEngine(); all player data through
 * src/lib/snapshot. The server is authoritative: ratings/records are always
 * recomputed by the engine here, never trusted from the client.
 */

import { z } from "zod";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { getEngine } from "@/lib/engine-provider";
import { getBaselines, getPlayerMap, getSnapshot } from "@/lib/snapshot";
import {
  NineCat,
  NINE_CATS,
  POSITIONS,
  Roster,
  SavedTeam,
  SeasonResult,
  TeamRating,
} from "@/lib/contracts";
import { validateRoster } from "@/components/social/validation";

/**
 * Roster parser that accepts every mode's shape: 5-man (0 bench), normal 8-man
 * (3 bench), and 10-player (5 bench). The frozen contract's RosterSchema pins
 * the bench to 3; this is its persistence-layer counterpart, kept off the
 * frozen contract. The inferred shape is structurally a `Roster` (bench: string[]).
 */
export const FlexibleRosterSchema = z.object({
  starters: z.record(z.enum(POSITIONS), z.string()),
  bench: z.array(z.string()).min(0).max(5),
});

/** Bench length → roster size label stored on the Team/Lobby rows.
 *  0 bench = 5-man, 3 = 8-man (classic), 5 = 10-man. */
export function teamSizeOf(roster: Roster): number {
  return roster.bench.length === 0 ? 5 : roster.bench.length >= 5 ? 10 : 8;
}

/** Row shape returned by team queries below (with owner relation). */
export interface TeamWithOwner {
  slug: string;
  teamName: string;
  roster: unknown;
  snapshotVersion: string;
  ovr: number;
  offRating: number;
  defRating: number;
  catProfile: unknown;
  wins: number;
  losses: number;
  gatedCategory: string | null;
  createdAt: Date;
  ownerName: string | null;
  user: { displayName: string | null; name: string | null } | null;
}

export const teamInclude = {
  user: { select: { displayName: true, name: true } },
} as const;

export function ownerDisplayName(team: TeamWithOwner): string | null {
  return team.ownerName ?? team.user?.displayName ?? team.user?.name ?? null;
}

/**
 * Validates a roster against the current snapshot and recomputes engine
 * outputs. Throws RosterError with a user-facing message on invalid input.
 */
export class RosterError extends Error {}

export function computeTeamOutputs(roster: Roster): {
  rating: TeamRating;
  season: SeasonResult;
} {
  const snapshot = getSnapshot();
  const players = getPlayerMap(snapshot);
  // Accept 5-man (0 bench), normal 8-man (3 bench), and 10-man (5 bench).
  const validation = validateRoster(roster, players, { benchCounts: [0, 3, 5] });
  if (!validation.ok) throw new RosterError(validation.error);

  const engine = getEngine();
  const rating = engine.teamRating(roster, players, getBaselines(snapshot));
  const season = engine.projectSeason(rating);
  return { rating, season };
}

function parseCatProfile(value: unknown): Record<NineCat, number> {
  const obj = (value ?? {}) as Record<string, unknown>;
  return Object.fromEntries(
    NINE_CATS.map((cat) => [cat, typeof obj[cat] === "number" ? obj[cat] : 0])
  ) as Record<NineCat, number>;
}

/** Rebuilds the TeamRating the engine produced at save time from DB columns. */
export function ratingFromRow(team: TeamWithOwner): TeamRating {
  return {
    ovr: team.ovr,
    offRating: team.offRating,
    defRating: team.defRating,
    catProfile: parseCatProfile(team.catProfile),
  };
}

/** Serializes a DB row to the SavedTeam contract shape. */
export function toSavedTeam(team: TeamWithOwner): SavedTeam {
  const rating = ratingFromRow(team);
  // projectSeason is deterministic from the rating; recomputing keeps the
  // response internally consistent (winCap isn't denormalized in the DB).
  const season = getEngine().projectSeason(rating);
  return {
    slug: team.slug,
    teamName: team.teamName,
    roster: FlexibleRosterSchema.parse(team.roster),
    snapshotVersion: team.snapshotVersion,
    rating,
    season,
    ownerDisplayName: ownerDisplayName(team),
    createdAt: team.createdAt.toISOString(),
  };
}

export async function findTeamBySlug(slug: string): Promise<TeamWithOwner | null> {
  return prisma.team.findUnique({ where: { slug }, include: teamInclude });
}

export async function loadSavedTeam(slug: string): Promise<SavedTeam | null> {
  const team = await findTeamBySlug(slug);
  return team ? toSavedTeam(team) : null;
}

/**
 * Casts a contract shape (Roster, catProfile, MatchupResult, …) to Prisma's
 * Json input type. These are plain JSON-serializable objects; the cast is
 * needed only because they lack a string index signature.
 */
export function toJsonInput(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

/** Standard JSON error response body. */
export function jsonError(status: number, error: string): Response {
  return Response.json({ error }, { status });
}

const DB_UNAVAILABLE_PATTERN =
  /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|database|connect|P1001|P1000|P2021/i;

/**
 * True when the failure smells like "no database is reachable yet".
 * Prisma driver-adapter errors carry the socket error code on `code` (e.g.
 * PrismaClientKnownRequestError with code "ECONNREFUSED") or nested in `cause`,
 * so the check walks name/code/message and the cause chain.
 */
export function isDbUnavailable(err: unknown, depth = 0): boolean {
  if (!err || depth > 5) return false;
  if (typeof err === "string") return DB_UNAVAILABLE_PATTERN.test(err);
  const e = err as { name?: unknown; code?: unknown; message?: unknown; cause?: unknown };
  const text = [e.name, e.code, e.message]
    .filter((v): v is string => typeof v === "string")
    .join(" ");
  if (DB_UNAVAILABLE_PATTERN.test(text)) return true;
  return isDbUnavailable(e.cause, depth + 1);
}

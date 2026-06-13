/** POST /api/lobbies — create a lobby with a fresh join code. The calling
 *  device becomes the creator: only it may end the lobby early. */

import { z } from "zod";
import { CreateLobbyRequestSchema, LobbyResponse } from "@/lib/contracts";
import { prisma } from "@/lib/db";
import { getOrCreateAnonId } from "@/lib/auth";
import { makeLobbyCode } from "@/components/social/hashing";
import { isDbUnavailable, jsonError } from "../_lib/teams";
import { RATE_LIMITS, rateLimitGate } from "../_lib/rate-limit";

const CODE_ATTEMPTS = 5;

/** Optional team cap, kept out of the frozen contract: 2–50, or omitted/null
 *  for unlimited. Parsed separately from CreateLobbyRequestSchema. */
export const LOBBY_LIMIT_MIN = 2;
export const LOBBY_LIMIT_MAX = 50;
export const TeamLimitSchema = z
  .number()
  .int()
  .min(LOBBY_LIMIT_MIN)
  .max(LOBBY_LIMIT_MAX)
  .nullable()
  .optional();

export async function POST(request: Request) {
  const limited = await rateLimitGate(request, RATE_LIMITS.lobbyCreate);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Request body must be JSON");
  }

  const parsed = CreateLobbyRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid request");
  }

  const limitParsed = TeamLimitSchema.safeParse(
    (body as { limit?: unknown }).limit
  );
  if (!limitParsed.success) {
    return jsonError(400, `Team limit must be ${LOBBY_LIMIT_MIN}–${LOBBY_LIMIT_MAX}`);
  }
  const teamLimit = limitParsed.data ?? null;

  try {
    const creatorAnonId = await getOrCreateAnonId();
    for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
      const code = makeLobbyCode();
      try {
        const lobby = await prisma.lobby.create({
          data: { code, name: parsed.data.name, teamLimit, creatorAnonId },
        });
        const response: LobbyResponse = {
          code: lobby.code,
          name: lobby.name,
          createdAt: lobby.createdAt.toISOString(),
          closedAt: null,
          status: "open",
          winner: null,
          standings: [],
        };
        return Response.json(response, { status: 201 });
      } catch (err) {
        const isUniqueViolation =
          err instanceof Error && "code" in err && (err as { code?: string }).code === "P2002";
        if (!isUniqueViolation || attempt === CODE_ATTEMPTS - 1) throw err;
      }
    }
    return jsonError(500, "Could not allocate a lobby code");
  } catch (err) {
    if (isDbUnavailable(err)) {
      return jsonError(503, "Lobbies are temporarily unavailable");
    }
    throw err;
  }
}

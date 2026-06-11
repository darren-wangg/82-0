/** POST /api/lobbies — create a lobby with a fresh join code. The calling
 *  device becomes the creator: only it may end the lobby early. */

import { CreateLobbyRequestSchema, LobbyResponse } from "@/lib/contracts";
import { prisma } from "@/lib/db";
import { getOrCreateAnonId } from "@/lib/auth";
import { makeLobbyCode } from "@/components/social/hashing";
import { isDbUnavailable, jsonError } from "../_lib/teams";
import { lobbyClosesAt } from "../_lib/lobbies";

const CODE_ATTEMPTS = 5;

export async function POST(request: Request) {
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

  try {
    const creatorAnonId = await getOrCreateAnonId();
    for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
      const code = makeLobbyCode();
      try {
        const lobby = await prisma.lobby.create({
          data: { code, name: parsed.data.name, creatorAnonId },
        });
        const response: LobbyResponse = {
          code: lobby.code,
          name: lobby.name,
          createdAt: lobby.createdAt.toISOString(),
          closesAt: lobbyClosesAt(lobby.createdAt).toISOString(),
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

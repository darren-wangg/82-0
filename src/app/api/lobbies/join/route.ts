/** POST /api/lobbies/join — add a saved team to a lobby, return standings. */

import { JoinLobbyRequestSchema } from "@/lib/contracts";
import { prisma } from "@/lib/db";
import { isDbUnavailable, jsonError } from "../../_lib/teams";
import { loadLobbyResponse } from "../../_lib/lobbies";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Request body must be JSON");
  }

  const parsed = JoinLobbyRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid request");
  }
  const { code, teamSlug } = parsed.data;

  try {
    const [lobby, team] = await Promise.all([
      prisma.lobby.findUnique({ where: { code } }),
      prisma.team.findUnique({ where: { slug: teamSlug } }),
    ]);
    if (!lobby) return jsonError(404, "Lobby not found");
    if (!team) return jsonError(404, "Team not found");

    try {
      await prisma.lobbyEntry.create({ data: { lobbyCode: code, teamSlug } });
    } catch (err) {
      const isUniqueViolation =
        err instanceof Error && "code" in err && (err as { code?: string }).code === "P2002";
      if (!isUniqueViolation) throw err; // already joined → idempotent success
    }

    const response = await loadLobbyResponse(code);
    if (!response) return jsonError(404, "Lobby not found");
    return Response.json(response);
  } catch (err) {
    if (isDbUnavailable(err)) {
      return jsonError(503, "Lobbies are temporarily unavailable");
    }
    throw err;
  }
}

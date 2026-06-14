/**
 * GET /l/[code]/card — downloadable game-summary PNG for a CLOSED lobby, in
 * the same arcade style as the team card: top three on a podium (entrant
 * name, team name, full roster), everyone else listed below. Open lobbies
 * 409 — standings aren't final until the creator closes it.
 */

import { ImageResponse } from "next/og";
import { getPlayerMap } from "@/lib/snapshot";
import { loadLobbyResponse, loadLobbyRosters } from "@/app/api/_lib/lobbies";
import { RATE_LIMITS, rateLimitGate } from "@/app/api/_lib/rate-limit";
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  cardFonts,
  LobbyCard,
} from "@/components/social/retro-card";

export const dynamic = "force-dynamic";
// Text-only render (no headshot fetches), but satori on a big standings
// tree isn't free either.
export const maxDuration = 30;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const limited = await rateLimitGate(req, RATE_LIMITS.cardRender);
  if (limited) return limited;

  const { code } = await params;

  let lobby;
  let rosters;
  try {
    [lobby, rosters] = await Promise.all([
      loadLobbyResponse(code),
      loadLobbyRosters(code),
    ]);
  } catch {
    return new Response("Lobby data is unavailable right now.", { status: 503 });
  }
  if (!lobby) return new Response("Lobby not found.", { status: 404 });
  if (lobby.status === "open") {
    return new Response("The summary card unlocks when the lobby closes.", {
      status: 409,
    });
  }
  if (lobby.standings.length === 0) {
    return new Response("No teams entered this lobby.", { status: 404 });
  }

  const playerMap = getPlayerMap();
  const fonts = await cardFonts();

  return new ImageResponse(
    (
      <LobbyCard
        lobbyName={lobby.name}
        standings={lobby.standings}
        rosters={rosters}
        playerMap={playerMap}
      />
    ),
    {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      fonts,
      headers: {
        // Closed lobbies never change; cache the render forever.
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Disposition": `inline; filename="ultimate-draft-lobby-${code}.png"`,
      },
    }
  );
}

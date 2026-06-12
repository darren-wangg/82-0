/**
 * GET /l/[code]/card — downloadable game-summary PNG for a CLOSED lobby, in
 * the same arcade style as the team card: top three on a podium (entrant
 * name, team name, full roster), everyone else listed below. Open lobbies
 * 409 — standings aren't final until the creator closes it.
 */

import { ImageResponse } from "next/og";
import type { LobbyStanding, Roster } from "@/lib/contracts";
import { getPlayerMap } from "@/lib/snapshot";
import { loadLobbyResponse, loadLobbyRosters } from "@/app/api/_lib/lobbies";
import { RATE_LIMITS, rateLimitGate } from "@/app/api/_lib/rate-limit";
import {
  BG,
  CARD_HEIGHT,
  CARD_WIDTH,
  PANEL,
  Scanlines,
  cardFonts,
  rosterSlots,
} from "@/components/social/retro-card";

export const dynamic = "force-dynamic";

/** Gold / silver / bronze, arcade-saturated. */
const MEDAL = ["#ffe600", "#c9ccd6", "#ff9f0a"] as const;
const MEDAL_LABEL = ["1ST", "2ND", "3RD"] as const;
/** Podium block heights; the list below fits this many extra rows. */
const PODIUM_HEIGHTS = [240, 170, 130] as const;
const MAX_LIST_ROWS = 6;

function playerNames(
  roster: Roster | undefined,
  playerMap: ReturnType<typeof getPlayerMap>
): string[] {
  if (!roster) return [];
  return rosterSlots(roster, playerMap).map((s) => s.player?.name ?? "—");
}

function PodiumColumn({
  standing,
  players,
  rank,
}: {
  standing: LobbyStanding;
  players: string[];
  rank: 0 | 1 | 2;
}) {
  const medal = MEDAL[rank];
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minWidth: 0,
        alignItems: "center",
        justifyContent: "flex-end",
      }}
    >
      <div
        style={{
          display: "flex",
          fontFamily: "Press Start 2P",
          fontSize: 13,
          color: "rgba(255,255,255,0.72)",
          maxWidth: 300,
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        {(standing.displayName ?? "ANONYMOUS GM").toUpperCase()}
      </div>
      <div
        style={{
          display: "flex",
          marginTop: 10,
          fontSize: 34,
          lineHeight: 1.05,
          color: medal,
          textShadow: `0 0 18px ${medal}66`,
          maxWidth: 300,
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        {standing.teamName.toUpperCase()}
      </div>
      <div
        style={{
          display: "flex",
          marginTop: 8,
          fontFamily: "Press Start 2P",
          fontSize: 12,
          color: "rgba(255,255,255,0.55)",
        }}
      >
        {standing.wins}-{standing.losses} H2H
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginTop: 10,
        }}
      >
        {players.map((name, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              fontSize: 17,
              lineHeight: 1.35,
              color: i < 5 ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.5)",
              maxWidth: 290,
              whiteSpace: "nowrap",
              overflow: "hidden",
            }}
          >
            {name.toUpperCase()}
          </div>
        ))}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          alignSelf: "stretch",
          height: PODIUM_HEIGHTS[rank],
          marginTop: 14,
          backgroundColor: PANEL,
          borderTop: `6px solid ${medal}`,
          boxShadow: `0 -2px 34px ${medal}44`,
        }}
      >
        <div style={{ display: "flex", fontSize: 76, lineHeight: 1, color: medal }}>
          {rank + 1}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 8,
            fontFamily: "Press Start 2P",
            fontSize: 13,
            color: medal,
          }}
        >
          {MEDAL_LABEL[rank]}
        </div>
      </div>
    </div>
  );
}

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
  const podium = lobby.standings.slice(0, 3);
  const rest = lobby.standings.slice(3);
  const listed = rest.slice(0, MAX_LIST_ROWS);
  const overflow = rest.length - listed.length;
  // Classic podium order: runner-up left, champion center, third right.
  const columns = ([1, 0, 2] as const).filter((rank) => rank < podium.length);

  const fonts = await cardFonts();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: BG,
          backgroundImage: `radial-gradient(circle at 50% -10%, rgba(255, 230, 0, 0.22) 0%, rgba(13, 2, 33, 0) 55%)`,
          color: "#fff",
          padding: "52px 56px 40px",
          fontFamily: "Anton",
        }}
      >
        {/* header */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              fontFamily: "Press Start 2P",
              fontSize: 17,
              color: "#39ff14",
            }}
          >
            ★ FINAL STANDINGS ★
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 16,
              fontSize: 64,
              lineHeight: 1.05,
              color: "#ffe600",
              textShadow: "0 0 24px rgba(255, 230, 0, 0.45)",
              transform: "skewX(-6deg)",
              maxWidth: 960,
              whiteSpace: "nowrap",
              overflow: "hidden",
            }}
          >
            {lobby.name.toUpperCase()}
          </div>
        </div>

        {/* podium */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 22,
            marginTop: 34,
          }}
        >
          {columns.map((rank) => (
            <PodiumColumn
              key={rank}
              rank={rank}
              standing={podium[rank]}
              players={playerNames(rosters.get(podium[rank].teamSlug), playerMap)}
            />
          ))}
        </div>

        {/* everyone else */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            marginTop: 26,
          }}
        >
          {listed.map((standing, i) => {
            const players = playerNames(rosters.get(standing.teamSlug), playerMap);
            return (
              <div
                key={standing.teamSlug}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "12px 0",
                  borderTop: "2px solid rgba(255, 255, 255, 0.09)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 56,
                    height: 48,
                    backgroundColor: "rgba(255,255,255,0.12)",
                    color: "#fff",
                    fontSize: 26,
                    transform: "skewX(-8deg)",
                  }}
                >
                  {i + 4}
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    minWidth: 0,
                    marginLeft: 22,
                    marginRight: 16,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      fontSize: 30,
                      lineHeight: 1.1,
                      maxWidth: 760,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                    }}
                  >
                    {standing.teamName.toUpperCase()}
                    <span
                      style={{
                        marginLeft: 14,
                        color: "rgba(255,255,255,0.5)",
                        fontSize: 22,
                      }}
                    >
                      {(standing.displayName ?? "ANONYMOUS GM").toUpperCase()}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      marginTop: 4,
                      fontSize: 16,
                      color: "rgba(255,255,255,0.45)",
                      maxWidth: 760,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                    }}
                  >
                    {players.join(" · ").toUpperCase()}
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    fontFamily: "Press Start 2P",
                    fontSize: 13,
                    color: "rgba(255,255,255,0.6)",
                  }}
                >
                  {standing.wins}-{standing.losses}
                </div>
              </div>
            );
          })}
          {overflow > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginTop: 12,
                fontFamily: "Press Start 2P",
                fontSize: 12,
                color: "rgba(255,255,255,0.45)",
              }}
            >
              +{overflow} MORE {overflow === 1 ? "TEAM" : "TEAMS"}
            </div>
          )}
        </div>

        {/* footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 20,
            paddingTop: 24,
            borderTop: "3px solid rgba(255, 255, 255, 0.14)",
          }}
        >
          <div style={{ display: "flex", fontSize: 34 }}>
            <span style={{ color: "#ff9f0a" }}>ULTIMATE</span>
            <span style={{ color: "#fff", marginLeft: 12 }}>DRAFT</span>
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: "Press Start 2P",
              fontSize: 15,
              color: "#ff2d55",
            }}
          >
            GAME OVER
          </div>
        </div>

        <Scanlines />
      </div>
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

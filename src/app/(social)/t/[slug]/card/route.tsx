/**
 * GET /t/[slug]/card — downloadable team card PNG, styled after the 1993
 * arcade-cabinet aesthetic: black court, hyper-saturated neon, blocky
 * condensed caps (Anton) with pixel-font accents (Press Start 2P).
 *
 * Layout per the share-template spec: record up top, team OVR plate to the
 * right, team name below, then the 8 players as rows (headshot, name,
 * position, era). Teams are immutable once saved, so the response is cached
 * forever at the CDN.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { POSITIONS, SEASON_GAMES, type PlayerStatLine } from "@/lib/contracts";
import { getPlayerMap } from "@/lib/snapshot";
import { headshotSources } from "@/lib/headshots";
import { loadSavedTeam } from "@/app/api/_lib/teams";

export const dynamic = "force-dynamic";

const WIDTH = 1080;
const HEIGHT = 1620;

/** Arcade palette: row accents cycle through the classic neon set. */
const NEON = [
  "#ff2d55", // red
  "#00c2ff", // electric blue
  "#39ff14", // green
  "#ff2da0", // hot pink
  "#ff9f0a", // orange
  "#b026ff", // purple
  "#00ffd0", // cyan
  "#ffe600", // yellow
] as const;
const BG = "#0d0221";
const PANEL = "#160a2e";

function catchphrase(wins: number): string {
  if (wins === SEASON_GAMES) return "HE'S ON FIRE!";
  if (wins >= 75) return "HE'S HEATING UP!";
  if (wins >= 65) return "FROM DOWNTOWN!";
  return "REJECTED!";
}

/** First source in the chain that actually serves an image, as a data URI —
 *  satori can't fall through broken <img> sources the way the browser does. */
async function fetchHeadshot(p: PlayerStatLine): Promise<string | null> {
  for (const url of headshotSources(p)) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) continue;
      const type = res.headers.get("content-type") ?? "image/png";
      if (!type.startsWith("image/") || type.includes("svg")) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 200) continue;
      return `data:${type};base64,${buf.toString("base64")}`;
    } catch {
      // try the next source
    }
  }
  return null;
}

function Silhouette({ color }: { color: string }) {
  return (
    <svg width="72" height="72" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" fill={color} opacity="0.55" />
      <path
        d="M4 21c0-4 3.6-7 8-7s8 3 8 7"
        fill={color}
        opacity="0.55"
      />
    </svg>
  );
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  let team;
  try {
    team = await loadSavedTeam(slug);
  } catch {
    return new Response("Team data is unavailable right now.", { status: 503 });
  }
  if (!team) return new Response("Team not found.", { status: 404 });

  const playerMap = getPlayerMap();
  const slots: { label: string; bench: boolean; player: PlayerStatLine | null }[] = [
    ...POSITIONS.map((pos) => ({
      label: pos as string,
      bench: false,
      player: playerMap.get(team.roster.starters[pos] ?? "") ?? null,
    })),
    ...(["G", "F", "C"] as const).map((label, i) => ({
      label: label as string,
      bench: true,
      player: playerMap.get(team.roster.bench[i] ?? "") ?? null,
    })),
  ];

  const [anton, pressStart, ...headshots] = await Promise.all([
    readFile(join(process.cwd(), "src/assets/fonts/Anton-Regular.ttf")),
    readFile(join(process.cwd(), "src/assets/fonts/PressStart2P-Regular.ttf")),
    ...slots.map((s) => (s.player ? fetchHeadshot(s.player) : Promise.resolve(null))),
  ]);

  const perfect = team.season.losses === 0;
  const record = `${team.season.wins}-${team.season.losses}`;
  const recordGradient = perfect
    ? "linear-gradient(180deg, #ffe600 0%, #ff9f0a 45%, #ff2d55 100%)"
    : "linear-gradient(180deg, #00c2ff 0%, #b026ff 100%)";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: BG,
          backgroundImage: `radial-gradient(circle at 50% -10%, rgba(176, 38, 255, 0.35) 0%, rgba(13, 2, 33, 0) 55%)`,
          color: "#fff",
          padding: "52px 56px 40px",
          fontFamily: "Anton",
        }}
      >
        {/* header: record left, OVR plate right, team name below */}
        <div style={{ display: "flex", alignItems: "flex-start" }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div
              style={{
                display: "flex",
                fontSize: 170,
                lineHeight: 0.95,
                backgroundImage: recordGradient,
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              {record}
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 18,
                fontFamily: "Press Start 2P",
                fontSize: 17,
                color: perfect ? "#39ff14" : "#00c2ff",
              }}
            >
              {perfect ? "★ PERFECT SEASON ★" : "PROJECTED RECORD"}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "22px 34px",
              backgroundColor: PANEL,
              border: "5px solid #00c2ff",
              boxShadow: "0 0 44px rgba(0, 194, 255, 0.55)",
              transform: "rotate(-4deg)",
              marginTop: 8,
            }}
          >
            <div
              style={{
                display: "flex",
                fontFamily: "Press Start 2P",
                fontSize: 13,
                color: "#00c2ff",
              }}
            >
              TEAM OVR
            </div>
            <div style={{ display: "flex", fontSize: 84, lineHeight: 1.05 }}>
              {Math.round(team.rating.ovr)}
            </div>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 14,
            fontSize: 58,
            lineHeight: 1.05,
            color: "#ffe600",
            textShadow: "0 0 24px rgba(255, 230, 0, 0.45)",
            transform: "skewX(-6deg)",
            maxWidth: 940,
          }}
        >
          {team.teamName.toUpperCase()}
        </div>

        {/* 8 player rows */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            marginTop: 30,
          }}
        >
          {slots.map(({ label, bench, player }, i) => {
            const neon = NEON[i % NEON.length];
            const img = headshots[i];
            return (
              <div
                key={`${label}-${i}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  flex: 1,
                  borderBottom:
                    i < slots.length - 1
                      ? "2px solid rgba(255, 255, 255, 0.09)"
                      : "none",
                  opacity: bench ? 0.82 : 1,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 64,
                    height: 56,
                    backgroundColor: neon,
                    color: "#0d0221",
                    fontSize: 28,
                    transform: "skewX(-8deg)",
                    boxShadow: `0 0 22px ${neon}55`,
                  }}
                >
                  {label}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 96,
                    height: 96,
                    marginLeft: 26,
                    backgroundColor: PANEL,
                    border: `3px solid ${neon}`,
                    overflow: "hidden",
                  }}
                >
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={img}
                      alt=""
                      width={96}
                      height={96}
                      style={{ objectFit: "cover", width: 96, height: 96 }}
                    />
                  ) : (
                    <Silhouette color={neon} />
                  )}
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    marginLeft: 28,
                    marginRight: 16,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      fontSize: 42,
                      lineHeight: 1.1,
                      maxWidth: 620,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                    }}
                  >
                    {(player?.name ?? "—").toUpperCase()}
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      fontFamily: "Press Start 2P",
                      fontSize: 17,
                      color: neon,
                    }}
                  >
                    {player?.decade ?? ""}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      marginTop: 8,
                      fontFamily: "Press Start 2P",
                      fontSize: 10,
                      color: "rgba(255,255,255,0.55)",
                    }}
                  >
                    {player ? `${player.position} · ${player.peakSeason}` : ""}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* footer: wordmark + arcade callout */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 26,
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
              color: perfect ? "#ff2d55" : "#ffe600",
            }}
          >
            {catchphrase(team.season.wins)}
          </div>
        </div>

        {/* CRT scanlines over everything */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: WIDTH,
            height: HEIGHT,
            backgroundImage:
              "linear-gradient(rgba(0, 0, 0, 0) 50%, rgba(0, 0, 0, 0.22) 50%)",
            backgroundSize: "100% 6px",
          }}
        />
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: [
        { name: "Anton", data: anton, style: "normal", weight: 400 },
        {
          name: "Press Start 2P",
          data: pressStart,
          style: "normal",
          weight: 400,
        },
      ],
      headers: {
        // Saved teams never change; let the CDN keep the render forever.
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Disposition": `inline; filename="ultimate-draft-${slug}.png"`,
      },
    }
  );
}

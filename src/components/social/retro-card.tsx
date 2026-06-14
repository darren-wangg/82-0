/**
 * Shared renderer for the downloadable retro cards (team card, draft card,
 * lobby summary), styled after the 1993 arcade-cabinet aesthetic: black
 * court, hyper-saturated neon, blocky condensed caps (Anton) with pixel-font
 * accents (Press Start 2P). Server-only — reads font files and fetches
 * headshots; consumed by route handlers that wrap the JSX in ImageResponse.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  POSITIONS,
  SEASON_GAMES,
  type LobbyStanding,
  type PlayerStatLine,
  type Roster,
  type SeasonResult,
  type TeamRating,
} from "@/lib/contracts";
import { headshotSourcesRemote } from "@/lib/headshots";

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1620;

/** Arcade palette: row accents cycle through the classic neon set. */
export const NEON = [
  "#ff2d55", // red
  "#00c2ff", // electric blue
  "#39ff14", // green
  "#ff2da0", // hot pink
  "#ff9f0a", // orange
  "#b026ff", // purple
  "#00ffd0", // cyan
  "#ffe600", // yellow
] as const;
export const BG = "#0d0221";
export const PANEL = "#160a2e";

export function catchphrase(wins: number): string {
  if (wins === SEASON_GAMES) return "HE'S ON FIRE!";
  if (wins >= 75) return "HE'S HEATING UP!";
  if (wins >= 65) return "FROM DOWNTOWN!";
  return "REJECTED!";
}

type CardFont = { name: string; data: Buffer; style: "normal"; weight: 400 };
let fontsPromise: Promise<CardFont[]> | null = null;

export function cardFonts(): Promise<CardFont[]> {
  // Font files never change at runtime — read them once per process.
  fontsPromise ??= Promise.all([
    readFile(join(process.cwd(), "src/assets/fonts/Anton-Regular.ttf")),
    readFile(join(process.cwd(), "src/assets/fonts/PressStart2P-Regular.ttf")),
  ]).then(([anton, pressStart]) => [
    { name: "Anton", data: anton, style: "normal", weight: 400 },
    { name: "Press Start 2P", data: pressStart, style: "normal", weight: 400 },
  ]);
  return fontsPromise;
}

/** Per-process cache of url → data URI. Card renders mostly repeat the same
 *  popular players, and Wikimedia 429s repeat fetches of the same thumb —
 *  caching sidesteps both. Misses (null) are NOT cached so transient host
 *  trouble doesn't pin a silhouette for the process lifetime. */
const headshotCache = new Map<string, string>();
const HEADSHOT_CACHE_MAX = 600;

function cacheHeadshot(url: string, dataUri: string) {
  if (headshotCache.size >= HEADSHOT_CACHE_MAX) {
    // Map iterates in insertion order — drop the oldest entry.
    const oldest = headshotCache.keys().next().value;
    if (oldest !== undefined) headshotCache.delete(oldest);
  }
  headshotCache.set(url, dataUri);
}

/** Hard ceiling across ALL of a card's headshot fetches — slow hosts fail to
 *  silhouettes instead of pushing the render past the function timeout. */
const FETCH_DEADLINE_MS = 15_000;

/** First source in the chain that actually serves an image, as a data URI —
 *  satori can't fall through broken <img> sources the way the browser does.
 *  Honors 429 retry-after (Wikimedia throttles bursts) and retries network
 *  hiccups once before moving down the chain. Stops cold once `deadline`
 *  (epoch ms) passes. */
export async function fetchHeadshot(
  p: PlayerStatLine,
  deadline = Date.now() + FETCH_DEADLINE_MS
): Promise<string | null> {
  for (const url of headshotSourcesRemote(p)) {
    const cached = headshotCache.get(url);
    if (cached) return cached;
    for (let attempt = 0; attempt < 3; attempt++) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) return null;
      try {
        const res = await fetch(url, {
          headers: { "user-agent": "ultimate-draft-card/1.0" },
          signal: AbortSignal.timeout(Math.min(8000, remaining)),
        });
        if (res.status === 429 || res.status >= 500) {
          const retryAfter = Number(res.headers.get("retry-after"));
          const wait =
            Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 800;
          await new Promise((r) =>
            setTimeout(r, Math.min(wait, Math.max(0, deadline - Date.now())))
          );
          continue;
        }
        if (!res.ok) break; // definitive answer — try the next source
        const type = res.headers.get("content-type") ?? "image/png";
        if (!type.startsWith("image/") || type.includes("svg")) break;
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length < 200) break;
        const dataUri = `data:${type};base64,${buf.toString("base64")}`;
        cacheHeadshot(url, dataUri);
        return dataUri;
      } catch {
        // network hiccup/timeout — retry, then the next source
        await new Promise((r) => setTimeout(r, 400));
      }
    }
  }
  return null;
}

/** Headshots for a slot list, throttled — full parallelism trips host
 *  rate limits and turns photos into silhouettes at random. */
export async function fetchSlotHeadshots(
  slots: CardSlot[],
  limit = 3
): Promise<(string | null)[]> {
  const out: (string | null)[] = new Array(slots.length).fill(null);
  // One shared deadline for the whole card, not per player.
  const deadline = Date.now() + FETCH_DEADLINE_MS;
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, slots.length) }, async () => {
      while (next < slots.length) {
        const i = next++;
        const player = slots[i].player;
        if (player) out[i] = await fetchHeadshot(player, deadline);
      }
    })
  );
  return out;
}

export function Silhouette({ color }: { color: string }) {
  return (
    <svg width="72" height="72" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" fill={color} opacity="0.55" />
      <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" fill={color} opacity="0.55" />
    </svg>
  );
}

/** CRT scanlines over everything; render last inside the root div. */
export function Scanlines() {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        backgroundImage:
          "linear-gradient(rgba(0, 0, 0, 0) 50%, rgba(0, 0, 0, 0.22) 50%)",
        backgroundSize: "100% 6px",
      }}
    />
  );
}

export interface CardSlot {
  label: string;
  bench: boolean;
  player: PlayerStatLine | null;
}

/** Roster → display slots: 5 starters then the bench. The 8-man bench is
 *  G/F/C; 10-man's 5 bench slots are a second PG/SG/SF/PF/C. */
export function rosterSlots(
  roster: Roster,
  playerMap: Map<string, PlayerStatLine>
): CardSlot[] {
  const benchLabels =
    roster.bench.length >= 5 ? ["PG", "SG", "SF", "PF", "C"] : ["G", "F", "C"];
  return [
    ...POSITIONS.map((pos) => ({
      label: pos as string,
      bench: false,
      player: playerMap.get(roster.starters[pos] ?? "") ?? null,
    })),
    ...roster.bench.map((id, i) => ({
      label: benchLabels[i] ?? "B",
      bench: true,
      player: playerMap.get(id ?? "") ?? null,
    })),
  ];
}

export interface TeamCardProps {
  teamName: string;
  season: SeasonResult;
  rating: TeamRating;
  slots: CardSlot[];
  /** Data URIs aligned with `slots` (null → silhouette). */
  headshots: (string | null)[];
}

/** The full team card (header, 8 player rows, footer, scanlines). */
export function TeamCard({
  teamName,
  season,
  rating,
  slots,
  headshots,
}: TeamCardProps) {
  const perfect = season.losses === 0;
  const record = `${season.wins}-${season.losses}`;
  const recordGradient = perfect
    ? "linear-gradient(180deg, #ffe600 0%, #ff9f0a 45%, #ff2d55 100%)"
    : "linear-gradient(180deg, #00c2ff 0%, #b026ff 100%)";

  // The roster area is fixed height but the row count varies by mode (5 / 8 /
  // 10). Scale the per-row visuals so 5-man rows don't look sparse and 10-man
  // rows don't get cramped or overrun the card.
  const roomy = slots.length <= 5; // 5-man
  const compact = slots.length >= 10; // 10-man
  const shot = roomy ? 124 : compact ? 82 : 96;
  const labelW = roomy ? 72 : compact ? 56 : 64;
  const labelH = roomy ? 64 : compact ? 46 : 56;
  const labelFont = roomy ? 32 : compact ? 24 : 28;
  const nameFont = roomy ? 48 : compact ? 34 : 42;
  const decadeFont = roomy ? 18 : compact ? 14 : 17;

  return (
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
            {Math.round(rating.ovr)}
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
        {teamName.toUpperCase()}
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
                  width: labelW,
                  height: labelH,
                  backgroundColor: neon,
                  color: "#0d0221",
                  fontSize: labelFont,
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
                  width: shot,
                  height: shot,
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
                    width={shot}
                    height={shot}
                    style={{ objectFit: "cover", width: shot, height: shot }}
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
                    fontSize: nameFont,
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
                    fontSize: decadeFont,
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
          {catchphrase(season.wins)}
        </div>
      </div>

      <Scanlines />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lobby summary card (final standings for a closed lobby)
// ---------------------------------------------------------------------------

/** Gold / silver / bronze, arcade-saturated. */
const MEDAL = ["#ffe600", "#c9ccd6", "#ff9f0a"] as const;
const MEDAL_LABEL = ["1ST", "2ND", "3RD"] as const;
/** Podium block heights; the list below fits MAX_LIST_ROWS extra rows. */
const PODIUM_HEIGHTS = [240, 170, 130] as const;
export const LOBBY_MAX_LIST_ROWS = 6;

/** The lobby card fits its content — a 3-team lobby shouldn't carry the dead
 *  space of a 9-team one. satori can't be measured ahead of time, so the
 *  budgets below are deliberately a touch generous (footer never clips); any
 *  slack lands as a small bottom margin, not a mid-card gap. `rosterSize` is
 *  the slots-per-team (5 / 8 / 10) that set the podium player-name column. */
export function lobbyCardHeight(teamCount: number, rosterSize: number): number {
  const rest = Math.max(teamCount - 3, 0);
  const listed = Math.min(rest, LOBBY_MAX_LIST_ROWS);
  const overflow = rest - listed;
  const PADDING = 92; // 52 top + 40 bottom
  const HEADER = 120; // "FINAL STANDINGS" + lobby name
  const PODIUM = 34 + 360 + rosterSize * 24; // marginTop + labels/block + names
  const LIST = (listed > 0 ? 26 : 0) + listed * 80 + (overflow > 0 ? 30 : 0);
  const FOOTER = 95;
  return Math.round(PADDING + HEADER + PODIUM + LIST + FOOTER + 30);
}

function lobbyPlayerNames(
  roster: Roster | undefined,
  playerMap: Map<string, PlayerStatLine>
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
          color: "rgba(255,255,255,0.88)",
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
          color: "rgba(255,255,255,0.75)",
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
              fontSize: 18,
              lineHeight: 1.35,
              color: i < 5 ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.72)",
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

export interface LobbyCardProps {
  lobbyName: string;
  standings: LobbyStanding[];
  rosters: Map<string, Roster>;
  playerMap: Map<string, PlayerStatLine>;
}

/** The full lobby summary card: top-three podium + the rest listed below.
 *  Roster rows come from `rosterSlots`, so it adapts to 5 / 8 / 10-man lobbies. */
export function LobbyCard({ lobbyName, standings, rosters, playerMap }: LobbyCardProps) {
  const podium = standings.slice(0, 3);
  const rest = standings.slice(3);
  const listed = rest.slice(0, LOBBY_MAX_LIST_ROWS);
  const overflow = rest.length - listed.length;
  // Classic podium order: runner-up left, champion center, third right.
  const columns = ([1, 0, 2] as const).filter((rank) => rank < podium.length);

  return (
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
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
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
          {lobbyName.toUpperCase()}
        </div>
      </div>

      {/* podium */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 22, marginTop: 34 }}>
        {columns.map((rank) => (
          <PodiumColumn
            key={rank}
            rank={rank}
            standing={podium[rank]}
            players={lobbyPlayerNames(rosters.get(podium[rank].teamSlug), playerMap)}
          />
        ))}
      </div>

      {/* everyone else — no greedy flex:1, so the footer sits right under the
          content instead of being shoved to the bottom of a fixed card. */}
      <div style={{ display: "flex", flexDirection: "column", marginTop: 26 }}>
        {listed.map((standing, i) => {
          const players = lobbyPlayerNames(rosters.get(standing.teamSlug), playerMap);
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
                      color: "rgba(255,255,255,0.72)",
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
                    fontSize: 17,
                    color: "rgba(255,255,255,0.72)",
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
                  fontSize: 14,
                  color: "rgba(255,255,255,0.82)",
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
  );
}

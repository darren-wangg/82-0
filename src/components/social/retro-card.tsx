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
  type PlayerStatLine,
  type Roster,
  type SeasonResult,
  type TeamRating,
} from "@/lib/contracts";
import { headshotSources } from "@/lib/headshots";

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

/** First source in the chain that actually serves an image, as a data URI —
 *  satori can't fall through broken <img> sources the way the browser does.
 *  Honors 429 retry-after (Wikimedia throttles bursts) and retries network
 *  hiccups once before moving down the chain. */
export async function fetchHeadshot(p: PlayerStatLine): Promise<string | null> {
  for (const url of headshotSources(p)) {
    const cached = headshotCache.get(url);
    if (cached) return cached;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url, {
          headers: { "user-agent": "ultimate-draft-card/1.0" },
          signal: AbortSignal.timeout(8000),
        });
        if (res.status === 429 || res.status >= 500) {
          const retryAfter = Number(res.headers.get("retry-after"));
          await new Promise((r) =>
            setTimeout(r, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 800)
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
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, slots.length) }, async () => {
      while (next < slots.length) {
        const i = next++;
        const player = slots[i].player;
        if (player) out[i] = await fetchHeadshot(player);
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

/** Roster → the 8 display slots (5 starters then G/F/C bench). */
export function rosterSlots(
  roster: Roster,
  playerMap: Map<string, PlayerStatLine>
): CardSlot[] {
  return [
    ...POSITIONS.map((pos) => ({
      label: pos as string,
      bench: false,
      player: playerMap.get(roster.starters[pos] ?? "") ?? null,
    })),
    ...(["G", "F", "C"] as const).map((label, i) => ({
      label: label as string,
      bench: true,
      player: playerMap.get(roster.bench[i] ?? "") ?? null,
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
          {catchphrase(season.wins)}
        </div>
      </div>

      <Scanlines />
    </div>
  );
}

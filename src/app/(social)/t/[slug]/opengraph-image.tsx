/**
 * Open Graph card for /t/[slug]: team name, projected record, and starters.
 * Text-only by design — headshots can't be assumed to load, and the card must
 * render even when the database is unreachable (generic fallback).
 */

import { ImageResponse } from "next/og";
import { SavedTeam, POSITIONS } from "@/lib/contracts";
import { getPlayerMap } from "@/lib/snapshot";
import { loadSavedTeam } from "@/app/api/_lib/teams";

export const alt = "82-0 Plus team card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const bg = "#09090b";
const fg = "#fafafa";
const muted = "#a1a1aa";
const accent = "#f97316";

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let team: SavedTeam | null = null;
  try {
    team = await loadSavedTeam(slug);
  } catch {
    // No DB → generic card below.
  }

  if (!team) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: bg,
            color: fg,
            fontSize: 96,
            fontWeight: 800,
          }}
        >
          <div style={{ display: "flex" }}>
            <span style={{ color: accent }}>82</span>–0 PLUS
          </div>
          <div style={{ fontSize: 32, color: muted, marginTop: 16 }}>
            Draft an all-time NBA roster
          </div>
        </div>
      ),
      { ...size }
    );
  }

  const players = getPlayerMap();
  const starters = POSITIONS.map((pos) => {
    const p = players.get(team.roster.starters[pos] ?? "");
    return { pos, name: p?.name ?? "—" };
  });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundColor: bg,
          color: fg,
          padding: 64,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            flex: 1,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: accent }}>
              82–0 PLUS
            </div>
            <div
              style={{
                fontSize: 64,
                fontWeight: 800,
                marginTop: 12,
                maxWidth: 640,
              }}
            >
              {team.teamName}
            </div>
            <div style={{ display: "flex", fontSize: 26, color: muted, marginTop: 8 }}>
              {`by ${team.ownerDisplayName ?? "an anonymous GM"}`}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {starters.map((s) => (
              <div
                key={s.pos}
                style={{ display: "flex", fontSize: 28, marginTop: 6 }}
              >
                <span style={{ color: accent, width: 64, fontWeight: 700 }}>
                  {s.pos}
                </span>
                <span>{s.name}</span>
              </div>
            ))}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
        >
          <div style={{ fontSize: 160, fontWeight: 800, display: "flex" }}>
            {team.season.wins}
            <span style={{ color: muted }}>–</span>
            {team.season.losses}
          </div>
          <div style={{ fontSize: 26, color: muted }}>PROJECTED RECORD</div>
          <div style={{ fontSize: 30, marginTop: 24, display: "flex" }}>
            <span style={{ color: muted, marginRight: 12 }}>OVR</span>
            <span style={{ fontWeight: 700 }}>{Math.round(team.rating.ovr)}</span>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}

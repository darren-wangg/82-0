/**
 * Open Graph card for /m/[id]: both team names around the best-of-7 series
 * score, winner highlighted. Text-only by design (matches the team and lobby
 * cards) and falls back to a generic card when the database is unreachable.
 */

import { ImageResponse } from "next/og";
import type { MatchupResponse } from "@/lib/contracts";
import { loadMatchupResponse } from "@/app/api/_lib/matchups";

export const alt = "Ultimate Draft matchup card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const bg = "#09090b";
const fg = "#fafafa";
const muted = "#a1a1aa";
const accent = "#f97316";
const emerald = "#34d399";
/** Near-black with a faint warm wash toward the score. */
const bgGradient = `linear-gradient(120deg, ${bg} 0%, #111113 55%, #221208 100%)`;

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let m: MatchupResponse | null = null;
  try {
    m = await loadMatchupResponse(id);
  } catch {
    // No DB → generic card below.
  }

  if (!m) {
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
            backgroundImage: bgGradient,
            color: fg,
            fontSize: 96,
            fontWeight: 800,
          }}
        >
          <div style={{ display: "flex" }}>
            <span style={{ color: accent, marginRight: 24 }}>ULTIMATE</span> DRAFT
          </div>
          <div style={{ fontSize: 32, color: muted, marginTop: 16 }}>
            All-time rosters, head-to-head
          </div>
        </div>
      ),
      { ...size }
    );
  }

  const aWon = m.result.winner === "A";
  const sides = [
    { name: m.teamA.teamName, wins: m.result.seriesScore[0], won: aWon },
    { name: m.teamB.teamName, wins: m.result.seriesScore[1], won: !aWon },
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: bg,
          backgroundImage: bgGradient,
          color: fg,
          padding: 64,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 28,
            fontWeight: 700,
          }}
        >
          <div style={{ color: accent }}>ULTIMATE DRAFT</div>
          <div style={{ color: muted }}>HEAD-TO-HEAD · BEST-OF-7</div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flex: 1,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              flex: 1,
            }}
          >
            <div style={{ fontSize: 48, fontWeight: 800, textAlign: "left" }}>
              {sides[0].name}
            </div>
            {sides[0].won && (
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  marginTop: 12,
                  color: emerald,
                }}
              >
                SERIES WINNER
              </div>
            )}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 140,
              fontWeight: 800,
              padding: "0 40px",
            }}
          >
            <span style={{ color: sides[0].won ? emerald : fg }}>
              {sides[0].wins}
            </span>
            <span style={{ color: muted, margin: "0 20px" }}>–</span>
            <span style={{ color: sides[1].won ? emerald : fg }}>
              {sides[1].wins}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              flex: 1,
            }}
          >
            <div style={{ fontSize: 48, fontWeight: 800, textAlign: "right" }}>
              {sides[1].name}
            </div>
            {sides[1].won && (
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  marginTop: 12,
                  color: emerald,
                }}
              >
                SERIES WINNER
              </div>
            )}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}

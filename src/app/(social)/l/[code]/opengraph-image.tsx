/**
 * Open Graph card for /l/[code]: lobby name, roster size, budget cap, and how
 * many teams are in. Text-only by design (matches the team card) and falls
 * back to a generic card when the database is unreachable.
 */

import { ImageResponse } from "next/og";
import { budgetCap } from "@/lib/budget";
import {
  loadLobbyShareSummary,
  type LobbyShareSummary,
} from "@/app/api/_lib/lobbies";

export const alt = "Ultimate Draft lobby card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const bg = "#09090b";
const fg = "#fafafa";
const muted = "#a1a1aa";
const accent = "#f97316";
const emerald = "#34d399";
const violet = "#c4b5fd";
/** Near-black with a faint warm wash toward the count corner. */
const bgGradient = `linear-gradient(120deg, ${bg} 0%, #111113 55%, #221208 100%)`;

export default async function Image({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  let lobby: LobbyShareSummary | null = null;
  try {
    lobby = await loadLobbyShareSummary(code);
  } catch {
    // No DB → generic card below.
  }

  if (!lobby) {
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
            Draft an all-time NBA roster
          </div>
        </div>
      ),
      { ...size }
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundColor: bg,
          backgroundImage: bgGradient,
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
              ULTIMATE DRAFT
            </div>
            <div
              style={{
                fontSize: 72,
                fontWeight: 800,
                marginTop: 12,
                maxWidth: 720,
              }}
            >
              {lobby.name}
            </div>
            <div style={{ display: "flex", fontSize: 30, marginTop: 20 }}>
              <span style={{ color: muted }}>
                {`${lobby.teamSize}-MAN LOBBY`}
              </span>
              {lobby.isBudget && (
                <span style={{ color: violet, marginLeft: 24 }}>
                  {`BUDGET · $${budgetCap(lobby.teamSize, "normal")} CAP`}
                </span>
              )}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 32,
              fontWeight: 700,
              color: lobby.open ? emerald : muted,
            }}
          >
            {lobby.open
              ? "OPEN — DRAFT YOUR TEAM AND JOIN THE FIGHT"
              : "CLOSED — SEE WHO TOOK THE CROWN"}
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
            {lobby.entrantCount}
          </div>
          <div style={{ fontSize: 26, color: muted }}>
            {lobby.entrantCount === 1 ? "TEAM IN" : "TEAMS IN"}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}

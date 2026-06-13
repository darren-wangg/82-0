/**
 * GET /api/draft-card?r={roster json}&name={team name} — retro card PNG for
 * an UNSAVED draft straight from /sim. The roster rides in the query string;
 * the server re-validates it and re-runs the engine (server-authoritative),
 * so the card never trusts client-computed ratings.
 */

import { ImageResponse } from "next/og";
import { RosterSchema } from "@/lib/contracts";
import { getPlayerMap } from "@/lib/snapshot";
import { RosterError, computeTeamOutputs } from "@/app/api/_lib/teams";
import { RATE_LIMITS, rateLimitGate } from "@/app/api/_lib/rate-limit";
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  TeamCard,
  cardFonts,
  fetchSlotHeadshots,
  rosterSlots,
} from "@/components/social/retro-card";

export const dynamic = "force-dynamic";
// Headshot fetches have a 15s internal deadline; give satori room on top.
export const maxDuration = 30;

const DEFAULT_NAME = "My Ultimate 8";

export async function GET(req: Request) {
  // Every unique roster payload is a fresh satori render — cap per IP.
  const limited = await rateLimitGate(req, RATE_LIMITS.cardRender);
  if (limited) return limited;

  const url = new URL(req.url);
  const teamName = (url.searchParams.get("name") ?? "").trim().slice(0, 40) || DEFAULT_NAME;

  let roster;
  try {
    roster = RosterSchema.parse(JSON.parse(url.searchParams.get("r") ?? ""));
  } catch {
    return new Response("Invalid roster.", { status: 400 });
  }

  let outputs;
  try {
    outputs = computeTeamOutputs(roster);
  } catch (err) {
    if (err instanceof RosterError) {
      return new Response(err.message, { status: 400 });
    }
    return new Response("Card rendering is unavailable right now.", { status: 503 });
  }

  const slots = rosterSlots(roster, getPlayerMap());
  const [fonts, headshots] = await Promise.all([
    cardFonts(),
    fetchSlotHeadshots(slots),
  ]);

  return new ImageResponse(
    (
      <TeamCard
        teamName={teamName}
        season={outputs.season}
        rating={outputs.rating}
        slots={slots}
        headshots={headshots}
      />
    ),
    {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      fonts,
      headers: {
        // Same URL → same card until the engine/snapshot is retuned.
        "Cache-Control": "public, max-age=3600",
        "Content-Disposition": 'inline; filename="ultimate-draft-team-card.png"',
      },
    }
  );
}

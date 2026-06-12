/**
 * GET /t/[slug]/card — downloadable team card PNG (see
 * src/components/social/retro-card.tsx for the shared arcade renderer).
 * Teams are immutable once saved, so the response is cached forever at the
 * CDN.
 */

import { ImageResponse } from "next/og";
import { getPlayerMap } from "@/lib/snapshot";
import { loadSavedTeam } from "@/app/api/_lib/teams";
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

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const limited = await rateLimitGate(req, RATE_LIMITS.cardRender);
  if (limited) return limited;

  const { slug } = await params;

  let team;
  try {
    team = await loadSavedTeam(slug);
  } catch {
    return new Response("Team data is unavailable right now.", { status: 503 });
  }
  if (!team) return new Response("Team not found.", { status: 404 });

  const slots = rosterSlots(team.roster, getPlayerMap());
  const [fonts, headshots] = await Promise.all([
    cardFonts(),
    fetchSlotHeadshots(slots),
  ]);

  return new ImageResponse(
    (
      <TeamCard
        teamName={team.teamName}
        season={team.season}
        rating={team.rating}
        slots={slots}
        headshots={headshots}
      />
    ),
    {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      fonts,
      headers: {
        // Saved teams never change; let the CDN keep the render forever.
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Disposition": `inline; filename="ultimate-draft-${slug}.png"`,
      },
    }
  );
}

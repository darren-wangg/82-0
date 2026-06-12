/**
 * GET /t/[slug]/card — downloadable team card PNG (see
 * src/components/social/retro-card.tsx for the shared arcade renderer).
 * Owner-only: the anon device cookie must match the team's owner — visitors
 * share the link/OG image instead of downloading the card.
 */

import { ImageResponse } from "next/og";
import { getAnonIdFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";
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
  let ownerAnonId: string | null;
  try {
    [team, ownerAnonId] = await Promise.all([
      loadSavedTeam(slug),
      prisma.team
        .findUnique({ where: { slug }, select: { anonIdentityId: true } })
        .then((row) => row?.anonIdentityId ?? null),
    ]);
  } catch {
    return new Response("Team data is unavailable right now.", { status: 503 });
  }
  if (!team) return new Response("Team not found.", { status: 404 });

  const anonId = await getAnonIdFromCookie();
  if (ownerAnonId === null || anonId === null || anonId !== ownerAnonId) {
    return new Response("Only the team's owner can save its card.", {
      status: 403,
    });
  }

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
        // Owner-gated, so the CDN must NOT share it — the owner's browser
        // may cache it forever (saved teams never change).
        "Cache-Control": "private, max-age=31536000, immutable",
        "Content-Disposition": `inline; filename="ultimate-draft-${slug}.png"`,
      },
    }
  );
}

/**
 * GET /api/budget/famous-teams — list all famous team presets (metadata only,
 * no roster details). Used by the Budget Challenge opponent picker.
 */

import { FAMOUS_TEAMS } from "@/lib/famous-teams";

export async function GET() {
  const teams = FAMOUS_TEAMS.map(({ slug, name, era, blurb }) => ({
    slug,
    name,
    era,
    blurb,
  }));
  return Response.json(teams);
}

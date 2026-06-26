/**
 * Team-logo URLs for the 30 franchises, keyed by the snapshot's franchiseId
 * (standard NBA tricodes). Uses ESPN's public logo CDN — unofficial, same
 * spirit as the player-headshot CDN: never assume the image loads, always
 * render a fallback (see <TeamLogo>).
 *
 * ESPN's slug differs from our tricode for a handful of teams; the rest are the
 * lowercased tricode.
 */

const ESPN_SLUG: Record<string, string> = {
  GSW: "gs",
  NOP: "no",
  NYK: "ny",
  SAS: "sa",
  UTA: "utah",
  WAS: "wsh",
};

/** ESPN logo URL for a franchiseId, or null if the id looks unknown. */
export function teamLogoUrl(franchiseId: string): string | null {
  if (!franchiseId) return null;
  const slug = ESPN_SLUG[franchiseId] ?? franchiseId.toLowerCase();
  return `https://a.espncdn.com/i/teamlogos/nba/500/${slug}.png`;
}

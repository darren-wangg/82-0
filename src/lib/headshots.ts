/**
 * Headshot source chain: NBA CDN (when an nbaPlayerId exists) followed by the
 * Wikipedia-thumbnail fallback resolved at ETL time (scripts/etl/headshots.ts).
 * Neither source is assumed to load — the UI falls through the list and ends
 * at a silhouette.
 */

import fallbacks from "../../public/data/headshot-fallbacks-v1.json";
import { headshotUrl, type PlayerStatLine } from "./contracts";

const FALLBACK_URLS: Record<string, string> = (
  fallbacks as { urls: Record<string, string> }
).urls;

export function headshotSources(
  p: Pick<PlayerStatLine, "nbaPlayerId" | "playerSlug">
): string[] {
  const cdn = headshotUrl(p);
  const fallback = FALLBACK_URLS[p.playerSlug];
  return [...(cdn ? [cdn] : []), ...(fallback ? [fallback] : [])];
}

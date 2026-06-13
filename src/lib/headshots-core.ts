/**
 * Headshot source-chain logic shared by the server accessor (static import)
 * and the client accessor (fetched map). No JSON imports here — that keeps
 * the fallback map out of the client JS bundle.
 */

import { headshotUrl, type PlayerStatLine } from "./contracts";

export type FallbackUrls = Record<string, string>;

/** Same-origin path to a player's baked static headshot, or null when the
 *  baker (scripts/etl/bake-headshots.ts) couldn't produce one. */
export function bakedHeadshotPath(
  baked: ReadonlySet<string>,
  p: Pick<PlayerStatLine, "playerSlug">
): string | null {
  return baked.has(p.playerSlug) ? `/data/headshots/${p.playerSlug}.webp` : null;
}

/** Remote source chain (NBA CDN → resolved fallback host). Used by the OG
 *  card renderers and as the pre-bake / unbaked browser fallback. */
export function headshotSourcesFrom(
  fallbackUrls: FallbackUrls,
  p: Pick<PlayerStatLine, "nbaPlayerId" | "playerSlug">
): string[] {
  const cdn = headshotUrl(p);
  const fallback = fallbackUrls[p.playerSlug];
  // The ETL only emits a fallback when the CDN serves its generic placeholder
  // (which loads with HTTP 200, so consumers can't error past it) — a mapped
  // fallback therefore always outranks the CDN. The CDN stays as a last
  // resort in case the fallback host dies.
  return [...(fallback ? [fallback] : []), ...(cdn ? [cdn] : [])];
}

/**
 * Full browser chain: the baked static asset first (served by us, no image
 * optimizer, immutable), then the remote chain as a fallback for any player
 * the bake hasn't covered yet. A local path here is the signal for the UI to
 * render a plain <img> rather than going through next/image.
 */
export function headshotChain(
  baked: ReadonlySet<string>,
  fallbackUrls: FallbackUrls,
  p: Pick<PlayerStatLine, "nbaPlayerId" | "playerSlug">
): string[] {
  const local = bakedHeadshotPath(baked, p);
  return [...(local ? [local] : []), ...headshotSourcesFrom(fallbackUrls, p)];
}

/** True for our own baked static assets (render via <img>, not next/image). */
export function isLocalHeadshot(src: string): boolean {
  return src.startsWith("/data/headshots/");
}

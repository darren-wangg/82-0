/**
 * Headshot source-chain logic shared by the server accessor (static import)
 * and the client accessor (fetched map). No JSON imports here — that keeps
 * the fallback map out of the client JS bundle.
 */

import { headshotUrl, type PlayerStatLine } from "./contracts";

export type FallbackUrls = Record<string, string>;

export function headshotSourcesFrom(
  fallbackUrls: FallbackUrls,
  p: Pick<PlayerStatLine, "nbaPlayerId" | "playerSlug">
): string[] {
  const cdn = headshotUrl(p);
  const fallback = fallbackUrls[p.playerSlug];
  return [...(cdn ? [cdn] : []), ...(fallback ? [fallback] : [])];
}

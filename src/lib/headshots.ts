/**
 * SERVER headshot source chain: NBA CDN (when an nbaPlayerId exists) followed
 * by the Wikipedia-thumbnail fallback resolved at ETL time
 * (scripts/etl/headshots.ts). Neither source is assumed to load — the UI
 * falls through the list and ends at a placeholder.
 *
 * The static import compiles the fallback map into the importing bundle;
 * client components must use src/lib/headshots-client.ts instead.
 */

import fallbacks from "../../public/data/headshot-fallbacks-v1.json";
import { type PlayerStatLine } from "./contracts";
import { headshotSourcesFrom, type FallbackUrls } from "./headshots-core";

const FALLBACK_URLS: FallbackUrls = (fallbacks as { urls: FallbackUrls }).urls;

export function headshotSources(
  p: Pick<PlayerStatLine, "nbaPlayerId" | "playerSlug">
): string[] {
  return headshotSourcesFrom(FALLBACK_URLS, p);
}

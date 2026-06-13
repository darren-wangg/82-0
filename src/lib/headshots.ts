/**
 * SERVER headshot source chain: the baked static asset first (when present),
 * then NBA CDN / the fallback host resolved at ETL time. Neither remote source
 * is assumed to load — the UI falls through the list and ends at a placeholder.
 *
 * The static imports compile the fallback map + baked manifest into the
 * importing bundle; client components must use src/lib/headshots-client.ts.
 *
 * Note: the OG card renderers (Satori) need an absolute, fetchable URL, so
 * they use `headshotSourcesRemote` (no local path) — see retro-card.tsx.
 */

import fallbacks from "../../public/data/headshot-fallbacks-v1.json";
import manifest from "../../public/data/headshot-manifest-v1.json";
import { type PlayerStatLine } from "./contracts";
import { headshotChain, headshotSourcesFrom, type FallbackUrls } from "./headshots-core";

const FALLBACK_URLS: FallbackUrls = (fallbacks as { urls: FallbackUrls }).urls;
const BAKED: ReadonlySet<string> = new Set((manifest as { slugs: string[] }).slugs);

/** Browser chain (baked local first). For rendered-in-a-browser <img>. */
export function headshotSources(
  p: Pick<PlayerStatLine, "nbaPlayerId" | "playerSlug">
): string[] {
  return headshotChain(BAKED, FALLBACK_URLS, p);
}

/** Remote-only chain — for server-side image renderers (Satori/OG) that must
 *  fetch an absolute URL and can't read our same-origin static assets. */
export function headshotSourcesRemote(
  p: Pick<PlayerStatLine, "nbaPlayerId" | "playerSlug">
): string[] {
  return headshotSourcesFrom(FALLBACK_URLS, p);
}

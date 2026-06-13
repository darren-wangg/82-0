/**
 * CLIENT headshot source chain. The fallback map (~86 KB raw) is fetched from
 * /data alongside the snapshot instead of being bundled. `GameProvider`
 * awaits `loadHeadshotFallbacks()` up front; until then the chain degrades to
 * NBA-CDN-only, which is always safe (every consumer handles image errors).
 */

import { type PlayerStatLine } from "./contracts";
import { headshotSourcesFrom, type FallbackUrls } from "./headshots-core";

const FALLBACKS_URL = "/data/headshot-fallbacks-v1.json";

let urls: FallbackUrls = {};
let pending: Promise<void> | null = null;

export function loadHeadshotFallbacks(): Promise<void> {
  // Timeout so a stalled connection can't wedge GameProvider's load gate.
  pending ??= fetch(FALLBACKS_URL, {
    cache: "force-cache",
    signal: AbortSignal.timeout(20_000),
  })
    .then((res) => {
      if (!res.ok) throw new Error(`fallback map fetch failed: ${res.status}`);
      return res.json();
    })
    .then((raw) => {
      urls = (raw as { urls: FallbackUrls }).urls ?? {};
    })
    .catch(() => {
      // Non-fatal: players covered only by the fallback map show their
      // placeholder instead. Allow a later retry.
      pending = null;
    });
  return pending;
}

export function headshotSources(
  p: Pick<PlayerStatLine, "nbaPlayerId" | "playerSlug">
): string[] {
  return headshotSourcesFrom(urls, p);
}

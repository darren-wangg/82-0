/**
 * CLIENT headshot source chain. Two small maps are fetched from /data (not
 * bundled): the baked manifest (slugs we serve a static webp for, no image
 * optimizer) and the remote fallback map (for any player the bake hasn't
 * covered). `GameProvider` awaits `loadHeadshotFallbacks()` up front; until
 * then the chain degrades to NBA-CDN-only, which is always safe (every
 * consumer handles image errors).
 */

import { type PlayerStatLine } from "./contracts";
import { headshotChain, type FallbackUrls } from "./headshots-core";

const FALLBACKS_URL = "/data/headshot-fallbacks-v1.json";
const MANIFEST_URL = "/data/headshot-manifest-v1.json";

let urls: FallbackUrls = {};
let baked: ReadonlySet<string> = new Set();
let pending: Promise<void> | null = null;

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    cache: "force-cache",
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`fetch failed: ${url} ${res.status}`);
  return res.json() as Promise<T>;
}

export function loadHeadshotFallbacks(): Promise<void> {
  // Baked manifest (browser serves these directly) + remote fallback map.
  // Timeout so a stalled connection can't wedge GameProvider's load gate.
  pending ??= Promise.all([
    fetchJson<{ slugs: string[] }>(MANIFEST_URL)
      .then((m) => {
        baked = new Set(m.slugs ?? []);
      })
      .catch(() => {
        // Non-fatal: fall back to the remote chain for everyone.
      }),
    fetchJson<{ urls: FallbackUrls }>(FALLBACKS_URL)
      .then((m) => {
        urls = m.urls ?? {};
      })
      .catch(() => {
        // Non-fatal: uncovered players show a silhouette. Allow a later retry.
      }),
  ])
    .then(() => undefined)
    .catch(() => {
      pending = null;
    });
  return pending;
}

export function headshotSources(
  p: Pick<PlayerStatLine, "nbaPlayerId" | "playerSlug">
): string[] {
  return headshotChain(baked, urls, p);
}

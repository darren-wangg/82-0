/**
 * Headshot fallback resolver.
 *
 * The NBA CDN only covers players with an nba_api id, and even then most
 * pre-2000 ids serve a generic league-logo placeholder — with HTTP 200, so
 * only content tells a real headshot apart. For every unique player in
 * snapshot-v1.json this script:
 *   1. downloads the CDN headshot (when an nbaPlayerId exists) and compares
 *      its hash against the placeholder's, and
 *   2. for misses, resolves a Wikipedia page-summary thumbnail by name —
 *      direct title first, then the search API — accepting only
 *      basketball-related, non-disambiguation pages.
 *
 * Output: public/data/headshot-fallbacks-v1.json — playerSlug → image URL on
 * upload.wikimedia.org. The UI chains NBA CDN → fallback → silhouette and
 * never assumes either image loads.
 *
 * Run with: npm run etl:headshots   (network results cached in .cache)
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { headshotUrl, SnapshotSchema } from "../../src/lib/contracts";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SNAPSHOT_FILE = path.join(ROOT, "public", "data", "snapshot-v1.json");
const OUT_FILE = path.join(ROOT, "public", "data", "headshot-fallbacks-v1.json");
const CACHE_FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  ".cache",
  "headshot-checks.json"
);

const USER_AGENT =
  "82-0-plus-etl/1.0 (one-time headshot fallback resolution; contact: repo owner)";
const CONCURRENCY = 8;
/** Wikipedia gets a gentler pace plus 429/5xx retries — misses are silent
 *  nulls, so a throttled burst would otherwise look like "no image". */
const WIKI_CONCURRENCY = 2;

async function wikiFetch(url: string): Promise<Response | null> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": USER_AGENT } });
      if (res.status !== 429 && res.status < 500) return res;
      const retryAfter = Number(res.headers.get("retry-after"));
      await new Promise((r) =>
        setTimeout(r, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1500 * (attempt + 1))
      );
    } catch {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  return null;
}

/** null = resolved to "no image"; absent = not yet checked. */
type Cache = {
  cdnOk: Record<string, boolean>; // nbaPlayerId → HEAD result
  wiki: Record<string, string | null>; // playerSlug → thumbnail URL
};

function loadCache(): Cache {
  if (existsSync(CACHE_FILE)) return JSON.parse(readFileSync(CACHE_FILE, "utf8"));
  return { cdnOk: {}, wiki: {} };
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    })
  );
  return out;
}

async function imageHash(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return createHash("sha1")
      .update(Buffer.from(await res.arrayBuffer()))
      .digest("hex");
  } catch {
    return null;
  }
}

/** Hash of the generic image the CDN serves (with HTTP 200) for unknown ids. */
async function placeholderHash(): Promise<string> {
  const hash = await imageHash(headshotUrl({ nbaPlayerId: 99999999 })!);
  if (!hash) throw new Error("could not fetch the CDN placeholder image");
  return hash;
}

interface WikiSummary {
  type?: string;
  description?: string;
  extract?: string;
  thumbnail?: { source?: string };
}

async function wikiSummary(title: string): Promise<WikiSummary | null> {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
    title.replaceAll(" ", "_")
  )}?redirect=true`;
  const res = await wikiFetch(url);
  if (!res?.ok) return null;
  try {
    return (await res.json()) as WikiSummary;
  } catch {
    return null;
  }
}

/** Thumbnail URL iff the page is a basketball person with an image. */
function acceptableThumb(s: WikiSummary | null): string | null {
  if (!s || s.type === "disambiguation") return null;
  const text = `${s.description ?? ""} ${s.extract ?? ""}`.toLowerCase();
  if (!text.includes("basketball")) return null;
  return s.thumbnail?.source ?? null;
}

/** Top page titles from the search API for "{name} basketball". */
async function wikiSearchTitles(name: string): Promise<string[]> {
  const url =
    "https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=3" +
    `&srsearch=${encodeURIComponent(`${name} basketball`)}`;
  const res = await wikiFetch(url);
  if (!res?.ok) return [];
  try {
    const data = (await res.json()) as {
      query?: { search?: Array<{ title: string }> };
    };
    return (data.query?.search ?? []).map((r) => r.title);
  } catch {
    return [];
  }
}

async function resolveWiki(name: string): Promise<string | null> {
  const direct = [name, `${name} (basketball)`];
  for (const title of direct) {
    const thumb = acceptableThumb(await wikiSummary(title));
    if (thumb) return thumb;
  }
  for (const title of await wikiSearchTitles(name)) {
    if (direct.includes(title)) continue;
    // Guard against the search surfacing a different player: the page title
    // must contain the player's name (modulo parentheticals).
    if (!title.toLowerCase().startsWith(name.toLowerCase())) continue;
    const thumb = acceptableThumb(await wikiSummary(title));
    if (thumb) return thumb;
  }
  return null;
}

async function main() {
  const snapshot = SnapshotSchema.parse(
    JSON.parse(readFileSync(SNAPSHOT_FILE, "utf8"))
  );
  const cache = loadCache();

  // Unique humans; keep the most recent line's name for Wikipedia lookups.
  const bySlug = new Map<string, { name: string; nbaPlayerId?: number }>();
  for (const p of snapshot.players) {
    bySlug.set(p.playerSlug, { name: p.name, nbaPlayerId: p.nbaPlayerId });
  }
  console.log(`headshots: ${bySlug.size} unique players`);

  // 1. CDN coverage check (real headshot vs the generic placeholder)
  const placeholder = await placeholderHash();
  const withId = [...bySlug.entries()].filter(([, v]) => v.nbaPlayerId !== undefined);
  const unchecked = withId.filter(([, v]) => !(String(v.nbaPlayerId) in cache.cdnOk));
  console.log(`  CDN: ${withId.length} with ids, ${unchecked.length} to check`);
  let checked = 0;
  await mapPool(unchecked, CONCURRENCY, async ([, v]) => {
    const hash = await imageHash(headshotUrl({ nbaPlayerId: v.nbaPlayerId })!);
    cache.cdnOk[String(v.nbaPlayerId)] = hash !== null && hash !== placeholder;
    if (++checked % 200 === 0) {
      console.log(`    ${checked}/${unchecked.length}`);
      writeFileSync(CACHE_FILE, JSON.stringify(cache));
    }
  });
  writeFileSync(CACHE_FILE, JSON.stringify(cache));

  // 2. Wikipedia fallback for players without a working CDN image
  const needsFallback = [...bySlug.entries()].filter(
    ([, v]) => v.nbaPlayerId === undefined || !cache.cdnOk[String(v.nbaPlayerId)]
  );
  const toResolve = needsFallback.filter(([slug]) => !(slug in cache.wiki));
  console.log(
    `  fallback needed for ${needsFallback.length} players, ${toResolve.length} to resolve`
  );
  let done = 0;
  await mapPool(toResolve, WIKI_CONCURRENCY, async ([slug, v]) => {
    cache.wiki[slug] = await resolveWiki(v.name);
    if (++done % 50 === 0) {
      console.log(`    ${done}/${toResolve.length}`);
      writeFileSync(CACHE_FILE, JSON.stringify(cache));
    }
  });
  writeFileSync(CACHE_FILE, JSON.stringify(cache));

  // 3. Emit the fallback map (only players that actually need + have one)
  const urls: Record<string, string> = {};
  for (const [slug] of needsFallback) {
    const url = cache.wiki[slug];
    if (url) urls[slug] = url;
  }
  const out = {
    version: "v1",
    generatedAt: new Date().toISOString(),
    attribution:
      "Fallback player images are Wikipedia page thumbnails served from " +
      "upload.wikimedia.org; each image's author and license are on its " +
      "Wikimedia Commons file page.",
    urls,
  };
  writeFileSync(OUT_FILE, JSON.stringify(out));
  console.log(
    `  resolved ${Object.keys(urls).length}/${needsFallback.length} fallbacks → ${OUT_FILE}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

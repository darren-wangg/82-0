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
 *      basketball-related, non-disambiguation pages, and
 *   3. for players Wikipedia still misses, matches against a bulk Wikidata
 *      query of every basketball player with a Commons image (P18) —
 *      unambiguous name matches only, each thumb verified with a HEAD, and
 *   4. for the remainder, queries theSportsDB's free API by exact name —
 *      accepted only when the name is unambiguous on BOTH sides (one
 *      basketball player with imagery there, one player with that name in
 *      our snapshot), each image verified with a HEAD.
 *
 * Output: public/data/headshot-fallbacks-v1.json — playerSlug → image URL on
 * upload.wikimedia.org / r2.thesportsdb.com. The UI chains NBA CDN →
 * fallback → placeholder and never assumes either image loads.
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
const WIKIDATA_CACHE_FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  ".cache",
  "wikidata-basketball.json"
);

const USER_AGENT =
  "82-0-plus-etl/1.0 (one-time headshot fallback resolution; contact: repo owner)";
const CONCURRENCY = 8;
/** Wikipedia gets a gentler pace plus 429/5xx retries — misses are silent
 *  nulls, so a throttled burst would otherwise look like "no image". */
const WIKI_CONCURRENCY = 2;

async function wikiFetch(url: string, timeoutMs = 20_000): Promise<Response | null> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "user-agent": USER_AGENT },
        signal: AbortSignal.timeout(timeoutMs),
      });
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
  wikidata: Record<string, string | null>; // playerSlug → thumbnail URL
  tsdb: Record<string, string | null>; // playerSlug → theSportsDB image URL
};

function loadCache(): Cache {
  const empty: Cache = { cdnOk: {}, wiki: {}, wikidata: {}, tsdb: {} };
  if (!existsSync(CACHE_FILE)) return empty;
  return { ...empty, ...JSON.parse(readFileSync(CACHE_FILE, "utf8")) };
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
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
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

// ---------------------------------------------------------------------------
// Wikidata bulk stage
// ---------------------------------------------------------------------------

/** Lowercased, deaccented, punctuation-free key for name matching. */
function normName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[.,'’"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** "larry nance sr" → "larry nance" (suffix-tolerant second-chance key). */
function stripGenSuffix(norm: string): string {
  return norm.replace(/\s+(jr|sr|ii|iii|iv)$/, "").trim();
}

interface WdRow {
  item: string; // QID URL
  name: string; // English label
  image: string; // Special:FilePath URL
}

/** Every basketball player on Wikidata with a Commons image, one query. */
async function wikidataRows(): Promise<WdRow[]> {
  if (existsSync(WIKIDATA_CACHE_FILE)) {
    return JSON.parse(readFileSync(WIKIDATA_CACHE_FILE, "utf8"));
  }
  const query = `SELECT ?item ?itemLabel ?image WHERE {
    ?item wdt:P106 wd:Q3665646; wdt:P18 ?image.
    ?item rdfs:label ?itemLabel. FILTER(LANG(?itemLabel) = "en")
  }`;
  const res = await wikiFetch(
    `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`,
    120_000
  );
  if (!res?.ok) throw new Error(`wikidata query failed: ${res?.status}`);
  const data = (await res.json()) as {
    results: {
      bindings: Array<{
        item: { value: string };
        itemLabel: { value: string };
        image: { value: string };
      }>;
    };
  };
  const rows: WdRow[] = data.results.bindings.map((b) => ({
    item: b.item.value,
    name: b.itemLabel.value,
    image: b.image.value,
  }));
  writeFileSync(WIKIDATA_CACHE_FILE, JSON.stringify(rows));
  return rows;
}

/** name key → image filenames, only when exactly one Wikidata item matches. */
function buildNameIndex(rows: WdRow[]): Map<string, string[]> {
  const byKey = new Map<string, Map<string, string[]>>(); // key → item → files
  const add = (key: string, row: WdRow) => {
    if (!key) return;
    const items = byKey.get(key) ?? new Map<string, string[]>();
    const files = items.get(row.item) ?? [];
    files.push(decodeURIComponent(row.image.split("/").pop() ?? ""));
    items.set(row.item, files);
    byKey.set(key, items);
  };
  for (const row of rows) {
    const norm = normName(row.name);
    add(norm, row);
    const stripped = stripGenSuffix(norm);
    if (stripped !== norm) add(stripped, row);
  }
  const out = new Map<string, string[]>();
  for (const [key, items] of byKey) {
    if (items.size === 1) out.set(key, [...items.values()][0]);
  }
  return out;
}

/** Deterministic Commons thumb URL (md5 path), raster formats only. Width
 *  must be a standard bucket (e.g. 250/500) — others get rejected upstream. */
function commonsThumb(filename: string, width: number): string | null {
  const fn = filename.replaceAll(" ", "_");
  if (!/\.(jpe?g|png|gif)$/i.test(fn)) return null;
  const h = createHash("md5").update(fn).digest("hex");
  const enc = encodeURIComponent(fn);
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${h[0]}/${h.slice(0, 2)}/${enc}/${width}px-${enc}`;
}

// ---------------------------------------------------------------------------
// theSportsDB stage (free community API; "123" is the public dev key)
// ---------------------------------------------------------------------------

const TSDB_SEARCH = "https://www.thesportsdb.com/api/v1/json/123/searchplayers.php?p=";

interface TsdbPlayer {
  strPlayer?: string;
  strSport?: string;
  strThumb?: string | null;
  strCutout?: string | null;
}

/**
 * Image URL for `name` iff exactly one basketball player with that exact name
 * has imagery there — common names (Eddie Johnson…) are skipped rather than
 * risk the wrong face. Gentle pacing + 429 retries: the free key is shared.
 */
async function resolveTsdb(name: string): Promise<string | null> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(TSDB_SEARCH + encodeURIComponent(name), {
        headers: { "user-agent": USER_AGENT },
        signal: AbortSignal.timeout(20_000),
      });
      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 15_000 * (attempt + 1)));
        continue;
      }
      if (!res.ok) return null;
      const data = (await res.json()) as { player?: TsdbPlayer[] | null };
      const withImage = (data.player ?? []).filter(
        (p) =>
          p.strSport === "Basketball" &&
          normName(p.strPlayer ?? "") === normName(name) &&
          (p.strThumb || p.strCutout)
      );
      if (withImage.length !== 1) return null;
      return withImage[0].strThumb ?? withImage[0].strCutout ?? null;
    } catch {
      await new Promise((r) => setTimeout(r, 3_000 * (attempt + 1)));
    }
  }
  return null;
}

async function urlOk(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: { "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(20_000),
    });
    return res.ok;
  } catch {
    return false;
  }
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

  // 3. Wikidata bulk match for players Wikipedia couldn't resolve
  const wikiMissed = needsFallback.filter(([slug]) => !cache.wiki[slug]);
  const wdToResolve = wikiMissed.filter(([slug]) => !(slug in cache.wikidata));
  console.log(
    `  Wikidata: ${wikiMissed.length} players missed by Wikipedia, ${wdToResolve.length} to resolve`
  );
  if (wdToResolve.length > 0) {
    const nameIndex = buildNameIndex(await wikidataRows());
    console.log(`    name index: ${nameIndex.size} unambiguous basketball names`);
    let wdDone = 0;
    await mapPool(wdToResolve, 6, async ([slug, v]) => {
      const norm = normName(v.name);
      const files = nameIndex.get(norm) ?? nameIndex.get(stripGenSuffix(norm)) ?? [];
      let url: string | null = null;
      outer: for (const file of files) {
        // 500px first; originals smaller than that 404, so retry at 250px.
        for (const width of [500, 250]) {
          const thumb = commonsThumb(file, width);
          if (thumb && (await urlOk(thumb))) {
            url = thumb;
            break outer;
          }
        }
      }
      cache.wikidata[slug] = url;
      if (++wdDone % 50 === 0) {
        console.log(`    ${wdDone}/${wdToResolve.length}`);
        writeFileSync(CACHE_FILE, JSON.stringify(cache));
      }
    });
    writeFileSync(CACHE_FILE, JSON.stringify(cache));
  }

  // 4. theSportsDB for players both Wikipedia and Wikidata missed
  const stillMissed = needsFallback.filter(
    ([slug]) => !cache.wiki[slug] && !cache.wikidata[slug]
  );
  // Our-side ambiguity guard: two distinct snapshot players sharing a display
  // name can't be told apart by a name search — skip them.
  const slugsByName = new Map<string, number>();
  for (const [, v] of bySlug) {
    const key = normName(v.name);
    slugsByName.set(key, (slugsByName.get(key) ?? 0) + 1);
  }
  const tsdbToResolve = stillMissed.filter(
    ([slug, v]) => !(slug in cache.tsdb) && slugsByName.get(normName(v.name)) === 1
  );
  console.log(
    `  theSportsDB: ${stillMissed.length} players still missed, ${tsdbToResolve.length} to resolve`
  );
  let tsdbDone = 0;
  // Sequential on purpose: shared free API key, be polite.
  for (const [slug, v] of tsdbToResolve) {
    const url = await resolveTsdb(v.name);
    cache.tsdb[slug] = url && (await urlOk(url)) ? url : null;
    if (++tsdbDone % 25 === 0) {
      console.log(`    ${tsdbDone}/${tsdbToResolve.length}`);
      writeFileSync(CACHE_FILE, JSON.stringify(cache));
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  writeFileSync(CACHE_FILE, JSON.stringify(cache));

  // 5. Emit the fallback map (only players that actually need + have one)
  const urls: Record<string, string> = {};
  for (const [slug] of needsFallback) {
    const url = cache.wiki[slug] ?? cache.wikidata[slug] ?? cache.tsdb[slug];
    if (url) urls[slug] = url;
  }
  const out = {
    version: "v1",
    generatedAt: new Date().toISOString(),
    attribution:
      "Fallback player images are Wikipedia page thumbnails and Wikidata " +
      "(P18) Commons images served from upload.wikimedia.org (author and " +
      "license on each image's Commons file page), plus community images " +
      "from theSportsDB.com.",
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

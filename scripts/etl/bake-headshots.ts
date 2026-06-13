/**
 * Headshot baker — turns the resolved headshot chain into small, static,
 * immutable webp files we serve ourselves, so the browser never goes through
 * Vercel's image optimizer (billed per transformation) or hits the unofficial
 * /flaky remote hosts at runtime.
 *
 * For every unique human in snapshot-v1.json it walks the same source chain
 * the app uses (NBA CDN → headshot-fallbacks-v1.json), downloads the first
 * candidate that is a real image (the CDN's generic placeholder is skipped by
 * hash), and writes a 128px square webp to public/data/headshots/{slug}.webp.
 * The set of slugs that got a file is emitted to
 * public/data/headshot-manifest-v1.json; the UI shows a silhouette for anyone
 * absent (which is exactly the set the remote chain couldn't cover either).
 *
 * Idempotent + offline-friendly: a slug whose webp already exists is skipped
 * unless you pass --force. Run with: npm run etl:bake-headshots
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { headshotUrl, SnapshotSchema } from "../../src/lib/contracts";
import { headshotSourcesFrom, type FallbackUrls } from "../../src/lib/headshots-core";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SNAPSHOT_FILE = path.join(ROOT, "public", "data", "snapshot-v1.json");
const FALLBACK_FILE = path.join(ROOT, "public", "data", "headshot-fallbacks-v1.json");
const OUT_DIR = path.join(ROOT, "public", "data", "headshots");
const MANIFEST_FILE = path.join(ROOT, "public", "data", "headshot-manifest-v1.json");

const SIZE = 128; // square; covers both circular avatars and 13:10 cards
const CONCURRENCY = 8;
const FORCE = process.argv.includes("--force");
/** Optional cap for a quick smoke run: `... -- --limit 20`. */
const LIMIT = (() => {
  const i = process.argv.indexOf("--limit");
  return i >= 0 ? Number(process.argv[i + 1]) : Infinity;
})();

async function mapPool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) await fn(items[next++]);
    })
  );
}

async function fetchBytes(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, {
      headers: {
        // Some long-tail fallback hosts reject non-browser agents.
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok || res.url.includes("removed")) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

const sha1 = (buf: Buffer) => createHash("sha1").update(buf).digest("hex");

async function main() {
  const snapshot = SnapshotSchema.parse(JSON.parse(readFileSync(SNAPSHOT_FILE, "utf8")));
  const fallbacks = (
    JSON.parse(readFileSync(FALLBACK_FILE, "utf8")) as { urls: FallbackUrls }
  ).urls;

  mkdirSync(OUT_DIR, { recursive: true });

  // Unique humans (keep the latest line's id/slug — headshots are per-person).
  const bySlug = new Map<string, { playerSlug: string; nbaPlayerId?: number }>();
  for (const p of snapshot.players) {
    bySlug.set(p.playerSlug, { playerSlug: p.playerSlug, nbaPlayerId: p.nbaPlayerId });
  }
  const players = [...bySlug.values()].slice(0, LIMIT);
  console.log(`baking headshots for ${players.length} unique players (size ${SIZE}px)`);

  // The CDN serves a generic placeholder (HTTP 200) for unknown ids; skip it.
  const placeholderBuf = await fetchBytes(headshotUrl({ nbaPlayerId: 99999999 })!);
  const placeholderHash = placeholderBuf ? sha1(placeholderBuf) : null;

  let baked = 0;
  let skipped = 0;
  let missed = 0;
  let done = 0;

  await mapPool(players, CONCURRENCY, async (p) => {
    const outFile = path.join(OUT_DIR, `${p.playerSlug}.webp`);
    if (!FORCE && existsSync(outFile)) {
      skipped++;
    } else {
      const candidates = headshotSourcesFrom(fallbacks, p);
      let wrote = false;
      for (const url of candidates) {
        const buf = await fetchBytes(url);
        if (!buf) continue;
        // Don't bake the CDN placeholder (it loads, but it's a league logo).
        if (placeholderHash && url.startsWith("https://cdn.nba.com") && sha1(buf) === placeholderHash) {
          continue;
        }
        try {
          await sharp(buf)
            .resize(SIZE, SIZE, { fit: "cover", position: "top" })
            .webp({ quality: 80 })
            .toFile(outFile);
          wrote = true;
          baked++;
          break;
        } catch {
          // not a decodable image — try the next candidate
        }
      }
      if (!wrote) missed++;
    }
    if (++done % 200 === 0) console.log(`  ${done}/${players.length}`);
  });

  // Manifest = every slug that has a file on disk (this run's + prior runs').
  const slugs = [...bySlug.keys()]
    .filter((slug) => existsSync(path.join(OUT_DIR, `${slug}.webp`)))
    .sort();
  writeFileSync(
    MANIFEST_FILE,
    JSON.stringify({ version: "v1", generatedAt: new Date().toISOString(), slugs })
  );

  console.log(
    `done: ${baked} baked, ${skipped} already present, ${missed} no image → ` +
      `${slugs.length} in manifest`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

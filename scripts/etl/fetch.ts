import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CACHE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), ".cache");

const DATASET_BASE =
  "https://raw.githubusercontent.com/sumitrodatta/bball-reference-datasets/master/Data";

export const NBA_API_PLAYERS_URL =
  "https://raw.githubusercontent.com/swar/nba_api/master/src/nba_api/stats/library/data.py";

async function download(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.text();
}

/** Fetch a URL with a local file cache under scripts/etl/.cache. */
export async function fetchCached(url: string, cacheName: string): Promise<string> {
  mkdirSync(CACHE_DIR, { recursive: true });
  const file = path.join(CACHE_DIR, cacheName);
  if (existsSync(file)) return readFileSync(file, "utf8");
  console.log(`  downloading ${url}`);
  const text = await download(url);
  writeFileSync(file, text);
  return text;
}

export async function fetchDatasetCsv(name: string): Promise<string> {
  return fetchCached(`${DATASET_BASE}/${encodeURIComponent(name)}.csv`, `${name}.csv`);
}

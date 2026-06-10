/**
 * Headshot id mapping: parse the nba_api project's static players list
 * (MIT-licensed; raw file on GitHub) and match by normalized full name.
 *
 * A match is only made when the normalized name is unique on BOTH sides
 * (exactly one stats.nba.com id and exactly one bbref slug), so common
 * name collisions (Bobby Jones, Mike Dunleavy, ...) are conservatively
 * left without a headshot rather than risk the wrong face.
 */

const ENTRY_RE = /\[(\d+),\s*"(?:[^"]*)",\s*"(?:[^"]*)",\s*"([^"]*)",\s*(?:True|False)\]/g;

export interface NbaApiPlayer {
  id: number;
  fullName: string;
}

export function parseNbaApiPlayers(pySource: string): NbaApiPlayer[] {
  const out: NbaApiPlayer[] = [];
  for (const m of pySource.matchAll(ENTRY_RE)) {
    out.push({ id: Number(m[1]), fullName: m[2] });
  }
  if (out.length < 3000) {
    throw new Error(`nba-ids: parsed only ${out.length} players; source format changed?`);
  }
  return out;
}

const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);

/** Lowercase, strip diacritics/punctuation/suffixes so both sources align. */
export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.,'’]/g, "")
    .replace(/-/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0 && !SUFFIXES.has(t))
    .join(" ");
}

/**
 * normalized name -> nba person id, only for names that map to exactly one id.
 */
export function buildNbaIdIndex(pySource: string): Map<string, number> {
  const byName = new Map<string, number[]>();
  for (const p of parseNbaApiPlayers(pySource)) {
    const key = normalizeName(p.fullName);
    const list = byName.get(key) ?? [];
    list.push(p.id);
    byName.set(key, list);
  }
  const unique = new Map<string, number>();
  for (const [name, ids] of byName) {
    if (ids.length === 1) unique.set(name, ids[0]);
  }
  return unique;
}

/* Wave 2 calibration: engine behavior over realistic DRAFTED rosters on real
 * data, plus named reference lineups with target bands for the concave model.
 * Run: npx tsx scripts/etl/dist-check.ts */
import { POSITIONS, Position, Roster, NINE_CATS } from "../../src/lib/contracts";
import { getSnapshot, getPlayerMap, getBaselines } from "../../src/lib/snapshot";
import { engine } from "../../src/engine";

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const snap = getSnapshot();
const players = getPlayerMap();
const baselines = getBaselines();

const combos: [string, string][] = [];
for (const [f, decs] of Object.entries(snap.pools))
  for (const [d, ids] of Object.entries(decs)) if (ids.length) combos.push([f, d]);

const score = (id: string) => engine.playerScore(engine.eraAdjust(players.get(id)!, baselines));
const scoreCache = new Map<string, number>();
const sc = (id: string) => { if (!scoreCache.has(id)) scoreCache.set(id, score(id)); return scoreCache.get(id)!; };

/** A casual drafter: random franchise×decade spins, takes one of the top-`k`
 *  pool players by individual score, starters assigned natural-position-first. */
function draftRoster(rand: () => number, k: number): Roster {
  const picked: string[] = [];
  const slugs = new Set<string>();
  while (picked.length < 8) {
    const [f, d] = combos[Math.floor(rand() * combos.length)];
    const pool = snap.pools[f][d].filter(id => !slugs.has(players.get(id)!.playerSlug));
    if (!pool.length) continue;
    const top = [...pool].sort((a, b) => sc(b) - sc(a)).slice(0, k);
    const id = top[Math.floor(rand() * top.length)];
    picked.push(id); slugs.add(players.get(id)!.playerSlug);
  }
  const sorted = [...picked].sort((a, b) => sc(b) - sc(a));
  const starters = {} as Record<Position, string>;
  const used = new Set<string>();
  for (const id of sorted) {
    if (Object.keys(starters).length === 5) break;
    const p = players.get(id)!;
    const prefs = [p.position, ...p.altPositions, ...POSITIONS];
    const slot = prefs.find(pos => !(pos in starters));
    if (slot) { starters[slot] = id; used.add(id); }
  }
  return { starters, bench: picked.filter(id => !used.has(id)).slice(0, 3) };
}

const q = (arr: number[], p: number) => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(p * s.length)]; };

function distribution(label: string, k: number, n: number) {
  const rand = mulberry32(11);
  const wins: number[] = [];
  const ovrs: number[] = [];
  let perfect = 0;
  for (let i = 0; i < n; i++) {
    const r = draftRoster(rand, k);
    const tr = engine.teamRating(r, players, baselines);
    const s = engine.projectSeason(tr);
    wins.push(s.wins); ovrs.push(tr.ovr);
    if (s.wins === 82) perfect++;
  }
  const rate = perfect / n;
  console.log(
    `${label} (top-${k}, n=${n}): wins p10 ${q(wins,0.1)} p25 ${q(wins,0.25)} med ${q(wins,0.5)} p75 ${q(wins,0.75)} p90 ${q(wins,0.9)} p99 ${q(wins,0.99)} | ovr p50 ${q(ovrs,0.5).toFixed(1)} p90 ${q(ovrs,0.9).toFixed(1)} p99 ${q(ovrs,0.99).toFixed(1)} | 82-0: ${perfect}/${n}` +
    (perfect ? ` ≈ 1 in ${Math.round(1 / rate)}` : "")
  );
}

console.log("=== drafted win distribution ===");
distribution("casual ", 3, 40000);
distribution("sharp  ", 2, 20000);
distribution("random ", 6, 20000);

console.log("\n=== category profile (casual drafter, p05/p50/p95) ===");
{
  const rand = mulberry32(11);
  const catZ: Record<string, number[]> = Object.fromEntries(NINE_CATS.map(c => [c, []]));
  for (let i = 0; i < 8000; i++) {
    const tr = engine.teamRating(draftRoster(rand, 3), players, baselines);
    for (const c of NINE_CATS) catZ[c].push(tr.catProfile[c]);
  }
  for (const c of NINE_CATS) console.log(`  ${c}: ${q(catZ[c],0.05).toFixed(2)} / ${q(catZ[c],0.5).toFixed(2)} / ${q(catZ[c],0.95).toFixed(2)}`);
}

const R = (starters: Record<Position, string>, bench: string[]): Roster => ({ starters, bench });

const REFERENCE: [string, Roster, string][] = [
  ["all-time          ", R(
    { PG: "johnsma02-LAL-1980s", SG: "jordami01-CHI-1990s", SF: "birdla01-BOS-1980s", PF: "duncati01-SAS-2000s", C: "chambwi01-GSW-1960s" },
    ["curryst01-GSW-2010s", "olajuha01-HOU-1990s", "jokicni01-DEN-2020s"]
  ), "must hit 82-0"],
  ["user (Curry/LBJ/   ", R(
    { PG: "curryst01-GSW-2010s", SG: "mitchdo01-CLE-2020s", SF: "jamesle01-LAL-2010s", PF: "duncati01-SAS-2000s", C: "onealsh01-ORL-1990s" },
    ["tatumja01-BOS-2020s", "paulch01-LAC-2010s", "georgpa01-OKC-2010s"]
  ), "Shaq/Duncan/Mitchell — loaded but creation-heavy"],
  ["balanced two-way   ", R(
    { PG: "fraziwa01-NYK-1970s", SG: "wadedw01-MIA-2000s", SF: "leonaka01-SAS-2010s", PF: "malonka01-UTA-1990s", C: "reedwi01-NYK-1970s" },
    ["ervinju01-PHI-1970s", "tatumja01-BOS-2020s", "nashst01-PHX-2000s"]
  ), "complementary, no transcendent anchor"],
  ["redundant offense  ", R(
    { PG: "westbru01-OKC-2010s", SG: "hardeja01-HOU-2010s", SF: "doncilu01-DAL-2020s", PF: "antetgi01-MIL-2020s", C: "jokicni01-DEN-2020s" },
    ["nashst01-PHX-2000s", "johnsma02-LAL-1980s", "curryst01-GSW-2010s"]
  ), "high-usage stack — redundancy + tov should tax it"],
  ["all-centers hole   ", R(
    { PG: "onealsh01-LAL-2000s", SG: "malonmo01-PHI-1980s", SF: "thurmna01-GSW-1960s", PF: "russebi01-BOS-1960s", C: "chambwi01-GSW-1960s" },
    ["reedwi01-NYK-1970s", "abdulka01-LAL-1980s", "embiijo01-PHI-2020s"]
  ), "great D, no spacing/ftPct — gate should bite"],
];

console.log("\n=== reference lineups ===");
for (const [label, r, note] of REFERENCE) {
  const ids = [...Object.values(r.starters), ...r.bench];
  const missing = ids.filter(id => !players.has(id));
  if (missing.length) { console.log(`${label} MISSING: ${missing.join(", ")}`); continue; }
  const tr = engine.teamRating(r, players, baselines);
  const s = engine.projectSeason(tr);
  console.log(
    `${label} ovr ${tr.ovr.toFixed(1)} off ${tr.offRating.toFixed(0)} def ${tr.defRating.toFixed(0)} → ${s.wins}-${s.losses}` +
    (s.gatedCategory ? ` [gated: ${s.gatedCategory} cap ${s.winCap}]` : "") +
    `  — ${note}`
  );
}

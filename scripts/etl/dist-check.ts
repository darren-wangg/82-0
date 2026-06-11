/* Wave 2 calibration: engine behavior over realistic DRAFTED rosters on real data. */
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
const rand = mulberry32(11);

// All (franchise, decade) combos with non-empty pools
const combos: [string, string][] = [];
for (const [f, decs] of Object.entries(snap.pools))
  for (const [d, ids] of Object.entries(decs)) if (ids.length) combos.push([f, d]);

const score = (id: string) => engine.playerScore(engine.eraAdjust(players.get(id)!, baselines));
const scoreCache = new Map<string, number>();
const sc = (id: string) => { if (!scoreCache.has(id)) scoreCache.set(id, score(id)); return scoreCache.get(id)!; };

function draftRoster(): Roster {
  // No decade exclusions — matches EXCLUDED_DECADES_PER_GAME = 0 in the game.
  const picked: string[] = [];
  const slugs = new Set<string>();
  while (picked.length < 8) {
    const [f, d] = combos[Math.floor(rand() * combos.length)];
    const pool = snap.pools[f][d].filter(id => !slugs.has(players.get(id)!.playerSlug));
    if (!pool.length) continue;
    // user picks one of the top 3 by score (greedy-ish)
    const top = [...pool].sort((a, b) => sc(b) - sc(a)).slice(0, 3);
    const id = top[Math.floor(rand() * top.length)];
    picked.push(id); slugs.add(players.get(id)!.playerSlug);
  }
  // assign starters greedily: best 5 by score to their natural positions where possible
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

const wins: number[] = [];
const ovrs: number[] = [];
const catZ: Record<string, number[]> = Object.fromEntries(NINE_CATS.map(c => [c, []]));
const gatedBy: Record<string, number> = {};
for (let n = 0; n < 2000; n++) {
  const r = draftRoster();
  const tr = engine.teamRating(r, players, baselines);
  const s = engine.projectSeason(tr);
  wins.push(s.wins); ovrs.push(tr.ovr);
  for (const c of NINE_CATS) catZ[c].push(tr.catProfile[c]);
  if (s.gatedCategory) gatedBy[s.gatedCategory] = (gatedBy[s.gatedCategory] ?? 0) + 1;
}
const q = (arr: number[], p: number) => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(p * s.length)]; };
console.log(`drafted wins: min ${q(wins,0)} p10 ${q(wins,0.1)} p25 ${q(wins,0.25)} med ${q(wins,0.5)} p75 ${q(wins,0.75)} p90 ${q(wins,0.9)} max ${q(wins,0.999)}`);
console.log(`drafted ovr : p10 ${q(ovrs,0.1).toFixed(1)} med ${q(ovrs,0.5).toFixed(1)} p90 ${q(ovrs,0.9).toFixed(1)}`);
console.log(`gated: ${(100 * Object.values(gatedBy).reduce((a,b)=>a+b,0) / wins.length).toFixed(1)}%`, gatedBy);
console.log("team cat z quantiles (p05 / p50 / p95):");
for (const c of NINE_CATS) console.log(`  ${c}: ${q(catZ[c],0.05).toFixed(2)} / ${q(catZ[c],0.5).toFixed(2)} / ${q(catZ[c],0.95).toFixed(2)}`);

const allTime: Roster = {
  starters: { PG: "johnsma02-LAL-1980s", SG: "jordami01-CHI-1990s", SF: "birdla01-BOS-1980s", PF: "duncati01-SAS-2000s", C: "chambwi01-GSW-1960s" },
  bench: ["curryst01-GSW-2010s", "olajuha01-HOU-1990s", "jokicni01-DEN-2020s"],
};
const tr = engine.teamRating(allTime, players, baselines);
console.log("all-time catProfile:", Object.fromEntries(NINE_CATS.map(c => [c, +tr.catProfile[c].toFixed(2)])));
console.log(`all-time ovr ${tr.ovr.toFixed(1)} →`, engine.projectSeason(tr));

const tovStack: Roster = {
  starters: { PG: "westbru01-OKC-2010s", SG: "hardeja01-HOU-2010s", SF: "doncilu01-DAL-2020s", PF: "antetgi01-MIL-2020s", C: "jokicni01-DEN-2020s" },
  bench: ["nashst01-PHX-2000s", "johnsma02-LAL-1980s", "curryst01-GSW-2010s"],
};
const ids2 = [...Object.values(tovStack.starters), ...tovStack.bench];
const missing = ids2.filter(id => !players.has(id));
if (missing.length) console.log("MISSING tovStack ids:", missing);
else {
  const tr2 = engine.teamRating(tovStack, players, baselines);
  console.log(`tov-stack: tov z ${tr2.catProfile.tov.toFixed(2)}, ovr ${tr2.ovr.toFixed(1)} →`, engine.projectSeason(tr2));
}
// check all test-helper roster ids exist in real data
for (const id of ["fraziwa01-NYK-1970s","wadedw01-MIA-2000s","leonaka01-SAS-2010s","malonka01-UTA-1990s","reedwi01-NYK-1970s","ervinju01-PHI-1970s","tatumja01-BOS-2020s","nashst01-PHX-2000s","onealsh01-LAL-2000s","malonmo01-PHI-1980s","thurmna01-GSW-1960s","russebi01-BOS-1960s","abdulka01-LAL-1980s","embiijo01-PHI-2020s"]) {
  if (!players.has(id)) console.log("MISSING helper id:", id);
}

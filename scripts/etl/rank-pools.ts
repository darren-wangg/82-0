/**
 * Rank every franchise×decade pool by the strength of the BEST player you
 * could draft from it (era-adjusted composite, same scoring the engine uses).
 * A spin lands you on one pool and you take one player, so the best available
 * player is what makes a combo good or bad. Prints the worst pools.
 *
 * Run: node --import tsx scripts/etl/rank-pools.ts
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { engine } from "../../src/engine";
import {
  SnapshotSchema,
  type Decade,
  type EraBaseline,
  type EraBaselines,
} from "../../src/lib/contracts";

const snapshot = SnapshotSchema.parse(
  JSON.parse(
    readFileSync(path.join(process.cwd(), "public/data/snapshot-v1.json"), "utf8")
  )
);

const baselines = Object.fromEntries(
  snapshot.baselines.map((b: EraBaseline) => [b.decade, b])
) as EraBaselines;

const byId = new Map(snapshot.players.map((p) => [p.id, p]));
const franchiseName = new Map(snapshot.franchises.map((f) => [f.id, f.name]));

interface PoolRank {
  fid: string;
  decade: Decade;
  size: number;
  best: number;
  top3: number;
  mean: number;
  bestPlayer: string;
}

const ranked: PoolRank[] = [];
for (const [fid, byDecade] of Object.entries(snapshot.pools)) {
  for (const [decade, ids] of Object.entries(byDecade)) {
    if (!ids || ids.length === 0) continue;
    const scored = ids
      .map((id) => byId.get(id))
      .filter((p): p is NonNullable<typeof p> => !!p)
      .map((p) => ({
        name: p.name,
        score: engine.playerScore(engine.eraAdjust(p, baselines)),
      }))
      .sort((a, b) => b.score - a.score);
    if (scored.length === 0) continue;
    const top3 = scored.slice(0, 3);
    ranked.push({
      fid,
      decade: decade as Decade,
      size: scored.length,
      best: scored[0].score,
      top3: top3.reduce((s, p) => s + p.score, 0) / top3.length,
      mean: scored.reduce((s, p) => s + p.score, 0) / scored.length,
      bestPlayer: scored[0].name,
    });
  }
}

// Worst = lowest best-available player; tiebreak on top-3 then mean.
ranked.sort((a, b) => a.best - b.best || a.top3 - b.top3 || a.mean - b.mean);

console.log(`Total non-empty pools: ${ranked.length}\n`);
console.log("WORST 15 (rank by best draftable player, era-adjusted):");
console.log("  #  pool                       size  best   top3   mean   best player");
ranked.slice(0, 15).forEach((r, i) => {
  const label = `${franchiseName.get(r.fid) ?? r.fid} ${r.decade}`;
  console.log(
    `${String(i + 1).padStart(3)}  ${label.padEnd(26)} ${String(r.size).padStart(3)}  ` +
      `${r.best.toFixed(2).padStart(5)}  ${r.top3.toFixed(2).padStart(5)}  ` +
      `${r.mean.toFixed(2).padStart(5)}  ${r.bestPlayer}`
  );
});

console.log("\nWORST 10 keys:");
console.log(JSON.stringify(ranked.slice(0, 10).map((r) => `${r.fid}|${r.decade}`)));

console.log("\nBEST 5 (for sanity):");
ranked
  .slice(-5)
  .reverse()
  .forEach((r) => {
    const label = `${franchiseName.get(r.fid) ?? r.fid} ${r.decade}`;
    console.log(
      `     ${label.padEnd(26)} ${String(r.size).padStart(3)}  ${r.best.toFixed(2).padStart(5)}  ${r.bestPlayer}`
    );
  });

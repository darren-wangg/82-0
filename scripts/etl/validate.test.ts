/**
 * Snapshot validation: public/data/snapshot-v1.json must parse against the
 * frozen SnapshotSchema and pass real-world sanity checks.
 *
 * If this suite fails with a missing-file error, run `npm run etl` first.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { DECADES, type Snapshot } from "../../src/lib/contracts";
import { SnapshotSchema } from "../../src/lib/contracts-schemas";

const SNAPSHOT_FILE = path.join(__dirname, "..", "..", "public", "data", "snapshot-v1.json");

const raw = JSON.parse(readFileSync(SNAPSHOT_FILE, "utf8"));
const snapshot: Snapshot = SnapshotSchema.parse(raw);
const byId = new Map(snapshot.players.map((p) => [p.id, p]));

describe("snapshot-v1", () => {
  it("validates against SnapshotSchema", () => {
    expect(snapshot.version).toBe("v1");
    expect(snapshot.attribution).toContain("CC BY-SA");
    expect(snapshot.players.length).toBeGreaterThan(1000);
  });

  it("has Wilt Chamberlain's 1961-62 peak on the 1960s Warriors", () => {
    const wilt = byId.get("chambwi01-GSW-1960s");
    expect(wilt).toBeDefined();
    expect(wilt!.stats.pts).toBeCloseTo(50.4, 1);
    expect(wilt!.stats.reb).toBeCloseTo(25.7, 1);
    // pre-1974 stl/blk/tov and pre-1974 ratings are estimates
    expect(wilt!.estimatedCats).toEqual(
      expect.arrayContaining(["stl", "blk", "tov", "ortg", "drtg"])
    );
  });

  it("has peak Michael Jordan on the 1990s Bulls", () => {
    const mj = byId.get("jordami01-CHI-1990s");
    expect(mj).toBeDefined();
    expect(mj!.stats.pts).toBeGreaterThan(28);
    expect(mj!.estimatedCats).toEqual([]);
  });

  it("has peak Stephen Curry on the 2010s Warriors", () => {
    const steph = byId.get("curryst01-GSW-2010s");
    expect(steph).toBeDefined();
    expect(steph!.stats.tpm).toBeGreaterThan(3.5);
  });

  it("covers all 30 franchises, each active decade with a non-empty pool", () => {
    expect(snapshot.franchises).toHaveLength(30);
    for (const f of snapshot.franchises) {
      expect(f.activeDecades.length).toBeGreaterThan(0);
      for (const decade of f.activeDecades) {
        const pool = snapshot.pools[f.id]?.[decade];
        expect(pool, `${f.id} ${decade}`).toBeDefined();
        expect(pool!.length, `${f.id} ${decade}`).toBeGreaterThan(0);
        for (const id of pool!) {
          expect(byId.get(id), `${f.id} ${decade} -> ${id}`).toBeDefined();
        }
      }
    }
  });

  it("has era baselines for all 7 decades with positive spreads", () => {
    expect(snapshot.baselines).toHaveLength(7);
    const decades = snapshot.baselines.map((b) => b.decade);
    expect(decades).toEqual([...DECADES]);
    for (const b of snapshot.baselines) {
      for (const [cat, sd] of Object.entries(b.sd)) {
        expect(sd, `${b.decade} sd.${cat}`).toBeGreaterThan(0);
      }
    }
  });

  it("has headshot ids for at least 60% of 1990s+ players", () => {
    const modern = snapshot.players.filter(
      (p) => DECADES.indexOf(p.decade) >= DECADES.indexOf("1990s")
    );
    const withId = modern.filter((p) => p.nbaPlayerId !== undefined);
    expect(withId.length / modern.length).toBeGreaterThanOrEqual(0.6);
  });

  it("keeps every player id consistent with its pool placement", () => {
    for (const p of snapshot.players) {
      expect(p.id).toBe(`${p.playerSlug}-${p.franchiseId}-${p.decade}`);
      expect(snapshot.pools[p.franchiseId][p.decade]).toContain(p.id);
    }
  });
});

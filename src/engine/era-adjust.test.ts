import { describe, expect, it } from "vitest";
import { EraBaselines, NINE_CATS, NineCat, PlayerStatLine } from "@/lib/contracts";
import { engine, Z_CLAMP } from "./index";
import { baselines, players } from "./test-helpers";

const wilt = players.get("chambwi01-GSW-1960s")!;
const magic = players.get("johnsma02-LAL-1980s")!;

describe("eraAdjust", () => {
  it("computes z-scores against the player's own decade baseline", () => {
    const adj = engine.eraAdjust(magic, baselines);
    const b = baselines[magic.decade];
    expect(adj.ast).toBeCloseTo((magic.stats.ast - b.mean.ast) / b.sd.ast, 10);
    expect(adj.pts).toBeCloseTo((magic.stats.pts - b.mean.pts) / b.sd.pts, 10);
    expect(adj.ortg).toBeCloseTo((magic.ortg - b.mean.ortg) / b.sd.ortg, 10);
  });

  it("sign-flips tov so fewer turnovers is better", () => {
    const adj = engine.eraAdjust(magic, baselines);
    const b = baselines[magic.decade];
    // Magic's high-usage tov is worse than the pool average → negative z.
    expect(adj.tov).toBeCloseTo(-((magic.stats.tov - b.mean.tov) / b.sd.tov), 10);
    expect(adj.tov).toBeLessThan(0);
  });

  it("sign-flips drtg so lower (better) defense yields positive z", () => {
    const adj = engine.eraAdjust(wilt, baselines);
    const b = baselines[wilt.decade];
    expect(adj.drtg).toBeCloseTo(-((wilt.drtg - b.mean.drtg) / b.sd.drtg), 10);
    expect(wilt.drtg).toBeLessThan(b.mean.drtg); // Wilt defends above average…
    expect(adj.drtg).toBeGreaterThan(0); // …so his adjusted drtg is positive.
  });

  it("clamps extreme z-scores to ±Z_CLAMP (outliers are elite, not infinite)", () => {
    const absurd: PlayerStatLine = {
      ...wilt,
      stats: { ...wilt.stats, pts: 500, blk: 100, tov: 60 },
    };
    const adj = engine.eraAdjust(absurd, baselines);
    expect(adj.pts).toBe(Z_CLAMP);
    expect(adj.blk).toBe(Z_CLAMP);
    expect(adj.tov).toBe(-Z_CLAMP);
    for (const cat of NINE_CATS) {
      expect(Math.abs(adj[cat])).toBeLessThanOrEqual(Z_CLAMP);
    }
  });

  it("guards against zero standard deviation", () => {
    const cloned: EraBaselines = JSON.parse(JSON.stringify(baselines));
    cloned["1960s"].sd.tpm = 0;
    const adj = engine.eraAdjust(wilt, cloned);
    expect(Number.isFinite(adj.tpm)).toBe(true);
  });
});

describe("playerScore", () => {
  it("ranks transcendent seasons above merely great ones", () => {
    const score = (id: string) =>
      engine.playerScore(engine.eraAdjust(players.get(id)!, baselines));
    expect(score("chambwi01-GSW-1960s")).toBeGreaterThan(
      score("havlijo01-BOS-1960s")
    );
    expect(score("jordami01-CHI-1990s")).toBeGreaterThan(
      score("pippesc01-CHI-1990s")
    );
  });

  it("never decreases when any single positive stat improves", () => {
    for (const p of players.values()) {
      const before = engine.playerScore(engine.eraAdjust(p, baselines));
      for (const cat of NINE_CATS) {
        const improved: PlayerStatLine = {
          ...p,
          stats: {
            ...p.stats,
            // tov improves by going DOWN; everything else by going up.
            [cat]: cat === "tov" ? Math.max(0, p.stats.tov - 0.5) : p.stats[cat] + (cat.endsWith("Pct") ? 0.02 : 1),
          },
        };
        const after = engine.playerScore(engine.eraAdjust(improved, baselines));
        expect(after).toBeGreaterThanOrEqual(before);
      }
      // Ratings too: better ortg and better (lower) drtg never hurt.
      const betterRatings: PlayerStatLine = { ...p, ortg: p.ortg + 2, drtg: p.drtg - 2 };
      expect(
        engine.playerScore(engine.eraAdjust(betterRatings, baselines))
      ).toBeGreaterThanOrEqual(before);
    }
  });

  it("is symmetric era-relative: identical z-profiles score identically across decades", () => {
    const a = engine.eraAdjust(players.get("jordami01-CHI-1990s")!, baselines);
    expect(engine.playerScore(a)).toBeCloseTo(engine.playerScore({ ...a }), 12);
  });
});

// Keep the cat union exhaustive if contracts ever change shape underneath us.
const _allCats: readonly NineCat[] = NINE_CATS;
void _allCats;

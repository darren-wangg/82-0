/**
 * Prisma seed: loads public/data/snapshot-v1.json into Player / PlayerSeason.
 *
 * Requires DATABASE_URL (Neon or local Postgres). DB provisioning is deferred,
 * so this script is written but intentionally NOT run in Wave 1.
 *
 * Run with: npx tsx scripts/etl/seed.ts
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../../src/generated/prisma/client";
import { SnapshotSchema } from "../../src/lib/contracts";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SNAPSHOT_FILE = path.join(ROOT, "public", "data", "snapshot-v1.json");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set; provision Postgres before seeding.");
  }

  const snapshot = SnapshotSchema.parse(JSON.parse(readFileSync(SNAPSHOT_FILE, "utf8")));
  const adapter = new PrismaPg({ connectionString: url });
  const prisma = new PrismaClient({ adapter });

  try {
    // One Player row per unique slug (name/nickname/nbaPlayerId are identical
    // across that player's decade entries).
    const bySlug = new Map<string, (typeof snapshot.players)[number]>();
    for (const p of snapshot.players) {
      if (!bySlug.has(p.playerSlug)) bySlug.set(p.playerSlug, p);
    }

    console.log(`Seeding ${bySlug.size} players...`);
    for (const p of bySlug.values()) {
      await prisma.player.upsert({
        where: { slug: p.playerSlug },
        create: {
          slug: p.playerSlug,
          name: p.name,
          nickname: p.nickname ?? null,
          nbaPlayerId: p.nbaPlayerId ?? null,
        },
        update: {
          name: p.name,
          nickname: p.nickname ?? null,
          nbaPlayerId: p.nbaPlayerId ?? null,
        },
      });
    }

    console.log(`Seeding ${snapshot.players.length} player seasons...`);
    for (const p of snapshot.players) {
      const season = {
        playerSlug: p.playerSlug,
        franchiseId: p.franchiseId,
        decade: p.decade,
        peakSeason: p.peakSeason,
        position: p.position,
        altPositions: p.altPositions,
        pts: p.stats.pts,
        reb: p.stats.reb,
        ast: p.stats.ast,
        stl: p.stats.stl,
        blk: p.stats.blk,
        fgPct: p.stats.fgPct,
        ftPct: p.stats.ftPct,
        tpm: p.stats.tpm,
        tov: p.stats.tov,
        ortg: p.ortg,
        drtg: p.drtg,
        estimatedCats: p.estimatedCats,
      };
      await prisma.playerSeason.upsert({
        where: { id: p.id },
        create: { id: p.id, ...season },
        update: season,
      });
    }

    console.log("Seed complete.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

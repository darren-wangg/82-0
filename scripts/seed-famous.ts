/**
 * scripts/seed-famous.ts
 *
 * Persists the curated famous-team rosters from src/lib/famous-teams.ts as
 * preset Team rows in the database. Run this once after the first migration
 * (or whenever the famous-team roster list changes):
 *
 *   npx tsx scripts/seed-famous.ts
 *
 * Each row uses a stable slug ("famous-96-bulls", etc.) so re-running is
 * idempotent (upsert). The isPreset flag ensures famous teams never pollute
 * regular leaderboards (boardWhere excludes isPreset rows).
 *
 * Note: Requires a live DATABASE_URL. Deferred until Neon/local Postgres exists.
 */

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { getEngine } from "../src/lib/engine-provider";
import { getBaselines, getPlayerMap, getSnapshot } from "../src/lib/snapshot";
import { FAMOUS_TEAMS } from "../src/lib/famous-teams";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set; provision Postgres before seeding.");
  }

  const adapter = new PrismaPg({ connectionString: url });
  const prisma = new PrismaClient({ adapter });

  const snapshot = getSnapshot();
  const players = getPlayerMap(snapshot);
  const baselines = getBaselines(snapshot);
  const engine = getEngine();

  console.log(`Seeding ${FAMOUS_TEAMS.length} famous teams…`);

  for (const ft of FAMOUS_TEAMS) {
    // Validate all player IDs exist in the current snapshot.
    const allIds = [...Object.values(ft.roster.starters), ...ft.roster.bench];
    for (const id of allIds) {
      if (!players.has(id)) {
        throw new Error(`Famous team ${ft.slug}: unknown player id "${id}"`);
      }
    }

    // Re-run the engine server-side (server authoritative).
    const rating = engine.teamRating(ft.roster, players, baselines);
    const season = engine.projectSeason(rating);

    await prisma.team.upsert({
      where: { slug: ft.slug },
      create: {
        slug: ft.slug,
        teamName: ft.name,
        ownerName: ft.era,
        roster: ft.roster as object,
        snapshotVersion: snapshot.version,
        teamSize: 8,
        ovr: rating.ovr,
        offRating: rating.offRating,
        defRating: rating.defRating,
        catProfile: rating.catProfile as object,
        wins: season.wins,
        losses: season.losses,
        gatedCategory: season.gatedCategory,
        isPreset: true,
      },
      update: {
        teamName: ft.name,
        ownerName: ft.era,
        roster: ft.roster as object,
        snapshotVersion: snapshot.version,
        teamSize: 8,
        ovr: rating.ovr,
        offRating: rating.offRating,
        defRating: rating.defRating,
        catProfile: rating.catProfile as object,
        wins: season.wins,
        losses: season.losses,
        gatedCategory: season.gatedCategory,
        isPreset: true,
      },
    });

    console.log(
      `  ${ft.slug}: ${season.wins}-${season.losses} (OVR ${rating.ovr})`
    );
  }

  console.log("Done.");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

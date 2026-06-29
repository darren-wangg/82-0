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
import type { Roster } from "../src/lib/contracts";
import { getEngine } from "../src/lib/engine-provider";
import { getBaselines, getPlayerMap, getSnapshot } from "../src/lib/snapshot";
import {
  famousRosterForSize,
  famousSlugForSize,
  FAMOUS_TEAMS,
} from "../src/lib/famous-teams";

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

  // Each famous team is seeded at BOTH budget sizes: the 6-man roster under its
  // base slug and the 8-man (5+3) roster under "<slug>-8", so a budget team of
  // either size faces a size-matched opponent.
  console.log(`Seeding ${FAMOUS_TEAMS.length} famous teams × 2 sizes…`);

  const upsertPreset = async (
    slug: string,
    name: string,
    era: string,
    roster: Roster
  ) => {
    const allIds = [...Object.values(roster.starters), ...roster.bench];
    for (const id of allIds) {
      if (!players.has(id)) {
        throw new Error(`Famous team ${slug}: unknown player id "${id}"`);
      }
    }

    // Re-run the engine server-side (server authoritative).
    const rating = engine.teamRating(roster, players, baselines);
    const season = engine.projectSeason(rating);
    const teamSize = 5 + roster.bench.length;

    const fields = {
      teamName: name,
      ownerName: era,
      roster: roster as object,
      snapshotVersion: snapshot.version,
      teamSize,
      ovr: rating.ovr,
      offRating: rating.offRating,
      defRating: rating.defRating,
      catProfile: rating.catProfile as object,
      wins: season.wins,
      losses: season.losses,
      gatedCategory: season.gatedCategory,
      isPreset: true,
    };

    await prisma.team.upsert({
      where: { slug },
      create: { slug, ...fields },
      update: fields,
    });

    console.log(
      `  ${slug}: ${season.wins}-${season.losses} (OVR ${rating.ovr}, ${teamSize}-man)`
    );
  };

  for (const ft of FAMOUS_TEAMS) {
    for (const size of [6, 8] as const) {
      await upsertPreset(
        famousSlugForSize(ft.slug, size),
        ft.name,
        ft.era,
        famousRosterForSize(ft, size)
      );
    }
  }

  console.log("Done.");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

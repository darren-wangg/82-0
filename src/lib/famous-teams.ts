/**
 * Budget Matchups — curated famous historical team presets.
 *
 * Each entry defines an 8-man classic roster (5 starters + 3 bench) using
 * real player IDs from public/data/snapshot-v1.json (verified). These are
 * seeded as preset Team rows via scripts/seed-famous.ts and used as opponents
 * in Budget Matchups via the standard POST /api/matchups path.
 *
 * Player IDs follow the pattern `{bbref_slug}-{franchise}-{decade}`.
 * All IDs were verified against snapshot-v1 (see scripts/seed-famous.ts).
 */

import type { Roster } from "./contracts";

export interface FamousTeam {
  /** Stable slug — used as the Team.slug in the DB (e.g. "famous-96-bulls"). */
  slug: string;
  /** Display name (shown in the opponent picker). */
  name: string;
  /** Short year/era label (e.g. "1995–96"). */
  era: string;
  /** One-line blurb for the opponent picker. */
  blurb: string;
  /** 8-man classic roster. */
  roster: Roster;
}

export const FAMOUS_TEAMS: FamousTeam[] = [
  {
    slug: "famous-96-bulls",
    name: "'96 Bulls",
    era: "1995–96",
    blurb: "72-win MJ/Pippen/Rodman juggernaut — the gold standard.",
    roster: {
      starters: {
        PG: "armstbj01-CHI-1990s", // B.J. Armstrong
        SG: "jordami01-CHI-1990s", // Michael Jordan
        SF: "pippesc01-CHI-1990s", // Scottie Pippen
        PF: "rodmade01-CHI-1990s", // Dennis Rodman
        C: "longllu01-CHI-1990s",  // Luc Longley
      },
      bench: [
        "kukocto01-CHI-1990s",  // Toni Kukoč
        "harpero01-CHI-1990s",  // Ron Harper
        "kerrst01-CHI-1990s",   // Steve Kerr
      ],
    },
  },
  {
    slug: "famous-86-celtics",
    name: "'86 Celtics",
    era: "1985–86",
    blurb: "Bird, McHale, Parish + off-the-bench Bill Walton. Best team ever?",
    roster: {
      starters: {
        PG: "johnsde01-BOS-1980s", // Dennis Johnson
        SG: "aingeda01-BOS-1980s", // Danny Ainge
        SF: "birdla01-BOS-1980s",  // Larry Bird
        PF: "mchalke01-BOS-1980s", // Kevin McHale
        C:  "parisro01-BOS-1980s", // Robert Parish
      },
      bench: [
        "maxwece01-BOS-1980s",  // Cedric Maxwell
        "waltobi01-BOS-1980s",  // Bill Walton
        "architi01-BOS-1980s",  // Tiny Archibald
      ],
    },
  },
  {
    slug: "famous-87-lakers",
    name: "'87 Lakers",
    era: "1986–87",
    blurb: "Showtime at its peak: Magic, Kareem, and Worthy.",
    roster: {
      starters: {
        PG: "johnsma02-LAL-1980s", // Magic Johnson
        SG: "scottby01-LAL-1980s", // Byron Scott
        SF: "worthja01-LAL-1980s", // James Worthy
        PF: "greenac01-LAL-1980s", // A.C. Green
        C:  "abdulka01-LAL-1980s", // Kareem Abdul-Jabbar
      },
      bench: [
        "wilkeja01-LAL-1980s",  // Jamaal Wilkes
        "coopemi01-LAL-1980s",  // Michael Cooper
        "rambiku01-LAL-1980s",  // Kurt Rambis
      ],
    },
  },
  {
    slug: "famous-00-lakers",
    name: "'00 Lakers",
    era: "1999–2000",
    blurb: "Shaq + Kobe begin their dynasty. Three-peat machine.",
    roster: {
      starters: {
        PG: "fishede01-LAL-2000s", // Derek Fisher
        SG: "bryanko01-LAL-2000s", // Kobe Bryant
        SF: "foxri01-LAL-2000s",   // Rick Fox
        PF: "odomla01-LAL-2000s",  // Lamar Odom
        C:  "onealsh01-LAL-2000s", // Shaquille O'Neal
      },
      bench: [
        "ricegl01-LAL-2000s",   // Glen Rice
        "horryro01-LAL-2000s",  // Robert Horry
        "paytoga01-LAL-2000s",  // Gary Payton
      ],
    },
  },
  {
    slug: "famous-73-knicks",
    name: "'73 Knicks",
    era: "1972–73",
    blurb: "The last Knicks dynasty. Frazier, Monroe, DeBusschere.",
    roster: {
      starters: {
        PG: "fraziwa01-NYK-1970s", // Walt Frazier
        SG: "monroea01-NYK-1970s", // Earl Monroe
        SF: "bradlbi01-NYK-1970s", // Bill Bradley
        PF: "debusda01-NYK-1970s", // Dave DeBusschere
        C:  "reedwi01-NYK-1970s",  // Willis Reed
      },
      bench: [
        "lucasje01-NYK-1970s",  // Jerry Lucas
        "haywosp01-NYK-1970s",  // Spencer Haywood
        "mcadobo01-NYK-1970s",  // Bob McAdoo
      ],
    },
  },
  {
    slug: "famous-95-rockets",
    name: "'95 Rockets",
    era: "1994–95",
    blurb: "Hakeem's back-to-back. Drexler reunion, Barkley arrived.",
    roster: {
      starters: {
        PG: "cassesa01-HOU-1990s", // Sam Cassell
        SG: "drexlcl01-HOU-1990s", // Clyde Drexler
        SF: "horryro01-HOU-1990s", // Robert Horry
        PF: "barklch01-HOU-1990s", // Charles Barkley
        C:  "olajuha01-HOU-1990s", // Hakeem Olajuwon
      },
      bench: [
        "smithke01-HOU-1990s",   // Kenny Smith
        "maxweve01-HOU-1990s",   // Vernon Maxwell
        "pippesc01-HOU-1990s",   // Scottie Pippen
      ],
    },
  },
  {
    slug: "famous-17-warriors",
    name: "'17 Warriors",
    era: "2016–17",
    blurb: "73-win core + KD = 16-1 playoffs. History's greatest offense.",
    roster: {
      starters: {
        PG: "curryst01-GSW-2010s",  // Stephen Curry
        SG: "thompkl01-GSW-2010s",  // Klay Thompson
        SF: "iguodan01-GSW-2010s",  // Andre Iguodala
        PF: "duranke01-GSW-2010s",  // Kevin Durant
        C:  "bogutan01-GSW-2010s",  // Andrew Bogut
      },
      bench: [
        "greendr01-GSW-2010s",   // Draymond Green
        "barneha02-GSW-2010s",   // Harrison Barnes
        "leeda02-GSW-2010s",     // David Lee
      ],
    },
  },
  {
    slug: "famous-13-heat",
    name: "'13 Heat",
    era: "2012–13",
    blurb: "LeBron's masterpiece season. The Big Three at their best.",
    roster: {
      starters: {
        PG: "dragigo01-MIA-2010s", // Goran Dragić
        SG: "wadedw01-MIA-2010s",  // Dwyane Wade
        SF: "jamesle01-MIA-2010s", // LeBron James
        PF: "boshch01-MIA-2010s",  // Chris Bosh
        C:  "onealje01-MIA-2010s", // Jermaine O'Neal
      },
      bench: [
        "richajo01-MIA-2010s",  // Josh Richardson
        "denglu01-MIA-2010s",   // Luol Deng
        "beaslmi01-MIA-2010s",  // Michael Beasley
      ],
    },
  },
  {
    slug: "famous-05-spurs",
    name: "'05 Spurs",
    era: "2004–05",
    blurb: "Duncan + Robinson's swan song, Parker and Ginóbili rising.",
    roster: {
      starters: {
        PG: "parketo01-SAS-2000s", // Tony Parker
        SG: "ginobma01-SAS-2000s", // Manu Ginóbili
        SF: "jacksst02-SAS-2000s", // Stephen Jackson
        PF: "duncati01-SAS-2000s", // Tim Duncan
        C:  "robinda01-SAS-2000s", // David Robinson
      },
      bench: [
        "nestera01-SAS-2000s",  // Rasho Nesterović
        "anderde01-SAS-2000s",  // Derek Anderson
        "turkohe01-SAS-2000s",  // Hedo Türkoğlu
      ],
    },
  },
  {
    slug: "famous-97-jazz",
    name: "'97 Jazz",
    era: "1996–97",
    blurb: "Stockton & Malone's Finals run. A dynasty that never got its ring.",
    roster: {
      starters: {
        PG: "stockjo01-UTA-1990s", // John Stockton
        SG: "hornaje01-UTA-1990s", // Jeff Hornacek
        SF: "corbity01-UTA-1990s", // Tyrone Corbin
        PF: "malonka01-UTA-1990s", // Karl Malone
        C:  "eatonma01-UTA-1990s", // Mark Eaton
      },
      bench: [
        "malonje01-UTA-1990s",  // Jeff Malone
        "russebr01-UTA-1990s",  // Bryon Russell
        "ostergr01-UTA-1990s",  // Greg Ostertag
      ],
    },
  },
];

/** Quick lookup by slug. */
export const FAMOUS_TEAM_BY_SLUG = new Map(
  FAMOUS_TEAMS.map((t) => [t.slug, t])
);

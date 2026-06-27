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
    blurb: "A 72-win Jordan–Pippen–Rodman juggernaut.",
    roster: {
      starters: {
        PG: "armstbj01-CHI-1990s", // B.J. Armstrong
        SG: "jordami01-CHI-1990s", // Michael Jordan
        SF: "pippesc01-CHI-1990s", // Scottie Pippen
        PF: "rodmade01-CHI-1990s", // Dennis Rodman
        C: "longllu01-CHI-1990s",  // Luc Longley
      },
      bench: [
        "kerrst01-CHI-1990s"  // Steve Kerr
      ],
    },
  },
  {
    slug: "famous-86-celtics",
    name: "'86 Celtics",
    era: "1985–86",
    blurb: "Bird, McHale, and Parish over a stacked bench.",
    roster: {
      starters: {
        PG: "johnsde01-BOS-1980s", // Dennis Johnson
        SG: "aingeda01-BOS-1980s", // Danny Ainge
        SF: "birdla01-BOS-1980s",  // Larry Bird
        PF: "mchalke01-BOS-1980s", // Kevin McHale
        C:  "parisro01-BOS-1980s", // Robert Parish
      },
      bench: [
        "maxwece01-BOS-1980s"  // Cedric Maxwell
      ],
    },
  },
  {
    slug: "famous-87-lakers",
    name: "'87 Lakers",
    era: "1986–87",
    blurb: "Showtime at its peak with Magic, Kareem, and Worthy.",
    roster: {
      starters: {
        PG: "johnsma02-LAL-1980s", // Magic Johnson
        SG: "scottby01-LAL-1980s", // Byron Scott
        SF: "worthja01-LAL-1980s", // James Worthy
        PF: "greenac01-LAL-1980s", // A.C. Green
        C:  "abdulka01-LAL-1980s", // Kareem Abdul-Jabbar
      },
      bench: [
        "wilkeja01-LAL-1980s"  // Jamaal Wilkes
      ],
    },
  },
  {
    slug: "famous-00-lakers",
    name: "'00 Lakers",
    era: "1999–2000",
    blurb: "Shaq and Kobe kick off a three-peat dynasty.",
    roster: {
      starters: {
        PG: "fishede01-LAL-2000s", // Derek Fisher
        SG: "bryanko01-LAL-2000s", // Kobe Bryant
        SF: "foxri01-LAL-2000s",   // Rick Fox
        PF: "odomla01-LAL-2000s",  // Lamar Odom
        C:  "onealsh01-LAL-2000s", // Shaquille O'Neal
      },
      bench: [
        "paytoga01-LAL-2000s"  // Gary Payton
      ],
    },
  },
  {
    slug: "famous-73-knicks",
    name: "'73 Knicks",
    era: "1972–73",
    blurb: "Frazier and Monroe deliver the last Knicks title.",
    roster: {
      starters: {
        PG: "fraziwa01-NYK-1970s", // Walt Frazier
        SG: "monroea01-NYK-1970s", // Earl Monroe
        SF: "bradlbi01-NYK-1970s", // Bill Bradley
        PF: "debusda01-NYK-1970s", // Dave DeBusschere
        C:  "reedwi01-NYK-1970s",  // Willis Reed
      },
      bench: [
        "mcadobo01-NYK-1970s"  // Bob McAdoo
      ],
    },
  },
  {
    slug: "famous-95-rockets",
    name: "'95 Rockets",
    era: "1994–95",
    blurb: "Hakeem powers a back-to-back title run.",
    roster: {
      starters: {
        PG: "cassesa01-HOU-1990s", // Sam Cassell
        SG: "drexlcl01-HOU-1990s", // Clyde Drexler
        SF: "horryro01-HOU-1990s", // Robert Horry
        PF: "barklch01-HOU-1990s", // Charles Barkley
        C:  "olajuha01-HOU-1990s", // Hakeem Olajuwon
      },
      bench: [
        "smithke01-HOU-1990s"  // Kenny Smith
      ],
    },
  },
  {
    slug: "famous-17-warriors",
    name: "'17 Warriors",
    era: "2016–17",
    blurb: "A 73-win core adds KD for a 16–1 playoff romp.",
    roster: {
      starters: {
        PG: "curryst01-GSW-2010s",  // Stephen Curry
        SG: "thompkl01-GSW-2010s",  // Klay Thompson
        SF: "iguodan01-GSW-2010s",  // Andre Iguodala
        PF: "duranke01-GSW-2010s",  // Kevin Durant
        C:  "bogutan01-GSW-2010s",  // Andrew Bogut
      },
      bench: [
        "greendr01-GSW-2010s"  // Draymond Green
      ],
    },
  },
  {
    slug: "famous-13-heat",
    name: "'13 Heat",
    era: "2012–13",
    blurb: "LeBron’s Big Three at the peak of their powers.",
    roster: {
      starters: {
        PG: "dragigo01-MIA-2010s", // Goran Dragić
        SG: "wadedw01-MIA-2010s",  // Dwyane Wade
        SF: "jamesle01-MIA-2010s", // LeBron James
        PF: "boshch01-MIA-2010s",  // Chris Bosh
        C:  "onealje01-MIA-2010s", // Jermaine O'Neal
      },
      bench: [
        "richajo01-MIA-2010s"  // Josh Richardson
      ],
    },
  },
  {
    slug: "famous-05-spurs",
    name: "'05 Spurs",
    era: "2004–05",
    blurb: "Duncan, Parker, and Ginóbili win it again.",
    roster: {
      starters: {
        PG: "parketo01-SAS-2000s", // Tony Parker
        SG: "ginobma01-SAS-2000s", // Manu Ginóbili
        SF: "jacksst02-SAS-2000s", // Stephen Jackson
        PF: "duncati01-SAS-2000s", // Tim Duncan
        C:  "robinda01-SAS-2000s", // David Robinson
      },
      bench: [
        "anderde01-SAS-2000s"  // Derek Anderson
      ],
    },
  },
  {
    slug: "famous-97-jazz",
    name: "'97 Jazz",
    era: "1996–97",
    blurb: "Stockton and Malone reach their first Finals.",
    roster: {
      starters: {
        PG: "stockjo01-UTA-1990s", // John Stockton
        SG: "hornaje01-UTA-1990s", // Jeff Hornacek
        SF: "corbity01-UTA-1990s", // Tyrone Corbin
        PF: "malonka01-UTA-1990s", // Karl Malone
        C:  "eatonma01-UTA-1990s", // Mark Eaton
      },
      bench: [
        "russebr01-UTA-1990s"  // Bryon Russell
      ],
    },
  },
  {
    slug: "famous-89-pistons",
    name: "'89 Pistons",
    era: "1988–89",
    blurb: "The Bad Boys bully the league behind Isiah.",
    roster: {
      starters: {
        PG: "thomais01-DET-1980s", // Isiah Thomas
        SG: "dumarjo01-DET-1980s", // Joe Dumars
        SF: "tripuke01-DET-1980s", // Kelly Tripucka
        PF: "mcadobo01-DET-1980s", // Bob McAdoo
        C:  "laimbbi01-DET-1980s", // Bill Laimbeer
      },
      bench: [
        "dantlad01-DET-1980s"  // Adrian Dantley
      ],
    },
  },
  {
    slug: "famous-83-sixers",
    name: "'83 Sixers",
    era: "1982–83",
    blurb: "Dr. J and Moses Malone steamroll the playoffs.",
    roster: {
      starters: {
        PG: "cheekma01-PHI-1980s", // Maurice Cheeks
        SG: "toneyan01-PHI-1980s", // Andrew Toney
        SF: "ervinju01-PHI-1980s", // Julius Erving
        PF: "barklch01-PHI-1980s", // Charles Barkley
        C:  "malonmo01-PHI-1980s", // Moses Malone
      },
      bench: [
        "dawkida01-PHI-1980s"  // Darryl Dawkins
      ],
    },
  },
  {
    slug: "famous-08-celtics",
    name: "'08 Celtics",
    era: "2007–08",
    blurb: "KG, Pierce, and Ray Allen raise banner 17.",
    roster: {
      starters: {
        PG: "rondora01-BOS-2000s", // Rajon Rondo
        SG: "allenra02-BOS-2000s", // Ray Allen
        SF: "piercpa01-BOS-2000s", // Paul Pierce
        PF: "garneke01-BOS-2000s", // Kevin Garnett
        C:  "jeffeal01-BOS-2000s", // Al Jefferson
      },
      bench: [
        "walkean02-BOS-2000s"  // Antoine Walker
      ],
    },
  },
  {
    slug: "famous-16-cavs",
    name: "'16 Cavs",
    era: "2015–16",
    blurb: "LeBron erases a 3–1 deficit for Cleveland.",
    roster: {
      starters: {
        PG: "irvinky01-CLE-2010s", // Kyrie Irving
        SG: "waitedi01-CLE-2010s", // Dion Waiters
        SF: "jamesle01-CLE-2010s", // LeBron James
        PF: "loveke01-CLE-2010s",  // Kevin Love
        C:  "hicksjj01-CLE-2010s", // J.J. Hickson
      },
      bench: [
        "willima01-CLE-2010s"  // Mo Williams
      ],
    },
  },
  {
    slug: "famous-14-spurs",
    name: "'14 Spurs",
    era: "2013–14",
    blurb: "Beautiful-game ball movement that buried the Heat.",
    roster: {
      starters: {
        PG: "parketo01-SAS-2010s", // Tony Parker
        SG: "ginobma01-SAS-2010s", // Manu Ginóbili
        SF: "leonaka01-SAS-2010s", // Kawhi Leonard
        PF: "duncati01-SAS-2010s", // Tim Duncan
        C:  "gasolpa01-SAS-2010s", // Pau Gasol
      },
      bench: [
        "aldrila01-SAS-2010s"  // LaMarcus Aldridge
      ],
    },
  },
  {
    slug: "famous-04-pistons",
    name: "'04 Pistons",
    era: "2003–04",
    blurb: "A star-less champion built on elite defense.",
    roster: {
      starters: {
        PG: "billuch01-DET-2000s", // Chauncey Billups
        SG: "hamilri01-DET-2000s", // Richard Hamilton
        SF: "princta01-DET-2000s", // Tayshaun Prince
        PF: "wallara01-DET-2000s", // Rasheed Wallace
        C:  "robincl02-DET-2000s", // Clifford Robinson
      },
      bench: [
        "hillgr01-DET-2000s"  // Grant Hill
      ],
    },
  },
  {
    slug: "famous-12-thunder",
    name: "'12 Thunder",
    era: "2011–12",
    blurb: "A young KD, Westbrook, and Harden reach the Finals.",
    roster: {
      starters: {
        PG: "westbru01-OKC-2010s", // Russell Westbrook
        SG: "hardeja01-OKC-2010s", // James Harden
        SF: "duranke01-OKC-2010s", // Kevin Durant
        PF: "ibakase01-OKC-2010s", // Serge Ibaka
        C:  "kanteen01-OKC-2010s", // Enes Kanter
      },
      bench: [
        "georgpa01-OKC-2010s"  // Paul George
      ],
    },
  },
  {
    slug: "famous-23-nuggets",
    name: "'23 Nuggets",
    era: "2022–23",
    blurb: "Jokić wins Denver’s first-ever title.",
    roster: {
      starters: {
        PG: "murraja01-DEN-2020s", // Jamal Murray
        SG: "braunch01-DEN-2020s", // Christian Braun
        SF: "portemi01-DEN-2020s", // Michael Porter Jr.
        PF: "gordoaa01-DEN-2020s", // Aaron Gordon
        C:  "jokicni01-DEN-2020s", // Nikola Jokić
      },
      bench: [
        "bartowi01-DEN-2020s"  // Will Barton
      ],
    },
  },
  {
    slug: "famous-21-bucks",
    name: "'21 Bucks",
    era: "2020–21",
    blurb: "Giannis drops 50 to clinch the title.",
    roster: {
      starters: {
        PG: "holidjr01-MIL-2020s", // Jrue Holiday
        SG: "lillada01-MIL-2020s", // Damian Lillard
        SF: "middlkh01-MIL-2020s", // Khris Middleton
        PF: "antetgi01-MIL-2020s", // Giannis Antetokounmpo
        C:  "lopezbr01-MIL-2020s", // Brook Lopez
      },
      bench: [
        "bledser01-MIL-2020s"  // Eric Bledsoe
      ],
    },
  },
  {
    slug: "famous-93-suns",
    name: "'93 Suns",
    era: "1992–93",
    blurb: "MVP Barkley carries Phoenix to the Finals.",
    roster: {
      starters: {
        PG: "johnske02-PHX-1990s", // Kevin Johnson
        SG: "hornaje01-PHX-1990s", // Jeff Hornacek
        SF: "majerda01-PHX-1990s", // Dan Majerle
        PF: "barklch01-PHX-1990s", // Charles Barkley
        C:  "mannida01-PHX-1990s", // Danny Manning
      },
      bench: [
        "kiddja01-PHX-1990s"  // Jason Kidd
      ],
    },
  },
  {
    slug: "famous-72-lakers",
    name: "'72 Lakers",
    era: "1971–72",
    blurb: "Winners of an NBA-record 33 straight games.",
    roster: {
      starters: {
        PG: "westje01-LAL-1970s",   // Jerry West
        SG: "goodrga01-LAL-1970s",  // Gail Goodrich
        SF: "bayloel01-LAL-1970s",  // Elgin Baylor
        PF: "hairsha01-LAL-1970s",  // Happy Hairston
        C:  "chambwi01-LAL-1970s",  // Wilt Chamberlain
      },
      bench: [
        "mcmilji01-LAL-1970s"  // Jim McMillian
      ],
    },
  },
];

/** Quick lookup by slug. */
export const FAMOUS_TEAM_BY_SLUG = new Map(
  FAMOUS_TEAMS.map((t) => [t.slug, t])
);

/**
 * The franchise behind a famous team (every preset is a single franchise×decade
 * composite). Parsed from a roster id (`{bbref}-{franchiseId}-{decade}`) so the
 * team logo can be looked up without an extra field on every entry.
 */
export function famousTeamFranchise(team: FamousTeam): string {
  return team.roster.starters.C.split("-")[1];
}

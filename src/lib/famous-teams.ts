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
  {
    slug: "famous-89-pistons",
    name: "'89 Pistons",
    era: "1988–89",
    blurb: "The Bad Boys. Isiah and Dumars bullied the league to a title.",
    roster: {
      starters: {
        PG: "thomais01-DET-1980s", // Isiah Thomas
        SG: "dumarjo01-DET-1980s", // Joe Dumars
        SF: "tripuke01-DET-1980s", // Kelly Tripucka
        PF: "mcadobo01-DET-1980s", // Bob McAdoo
        C:  "laimbbi01-DET-1980s", // Bill Laimbeer
      },
      bench: [
        "johnsvi01-DET-1980s",  // Vinnie Johnson
        "dantlad01-DET-1980s",  // Adrian Dantley
        "bensoke01-DET-1980s",  // Kent Benson
      ],
    },
  },
  {
    slug: "famous-83-sixers",
    name: "'83 Sixers",
    era: "1982–83",
    blurb: "Fo', Fo', Fo'. Dr. J and Moses Malone steamrolled the playoffs.",
    roster: {
      starters: {
        PG: "cheekma01-PHI-1980s", // Maurice Cheeks
        SG: "toneyan01-PHI-1980s", // Andrew Toney
        SF: "ervinju01-PHI-1980s", // Julius Erving
        PF: "barklch01-PHI-1980s", // Charles Barkley
        C:  "malonmo01-PHI-1980s", // Moses Malone
      },
      bench: [
        "hawkihe01-PHI-1980s",  // Hersey Hawkins
        "robincl01-PHI-1980s",  // Cliff Robinson
        "dawkida01-PHI-1980s",  // Darryl Dawkins
      ],
    },
  },
  {
    slug: "famous-08-celtics",
    name: "'08 Celtics",
    era: "2007–08",
    blurb: "The new Big Three — KG, Pierce, Ray Allen — raised banner 17.",
    roster: {
      starters: {
        PG: "rondora01-BOS-2000s", // Rajon Rondo
        SG: "allenra02-BOS-2000s", // Ray Allen
        SF: "piercpa01-BOS-2000s", // Paul Pierce
        PF: "garneke01-BOS-2000s", // Kevin Garnett
        C:  "jeffeal01-BOS-2000s", // Al Jefferson
      },
      bench: [
        "walkean02-BOS-2000s",  // Antoine Walker
        "davisri01-BOS-2000s",  // Ricky Davis
        "westde01-BOS-2000s",   // Delonte West
      ],
    },
  },
  {
    slug: "famous-16-cavs",
    name: "'16 Cavs",
    era: "2015–16",
    blurb: "Down 3–1, then history. LeBron brought Cleveland a title.",
    roster: {
      starters: {
        PG: "irvinky01-CLE-2010s", // Kyrie Irving
        SG: "waitedi01-CLE-2010s", // Dion Waiters
        SF: "jamesle01-CLE-2010s", // LeBron James
        PF: "loveke01-CLE-2010s",  // Kevin Love
        C:  "hicksjj01-CLE-2010s", // J.J. Hickson
      },
      bench: [
        "jamisan01-CLE-2010s",  // Antawn Jamison
        "willima01-CLE-2010s",  // Mo Williams
        "sessira01-CLE-2010s",  // Ramon Sessions
      ],
    },
  },
  {
    slug: "famous-14-spurs",
    name: "'14 Spurs",
    era: "2013–14",
    blurb: "Beautiful game. Ball movement that dismantled the Heat.",
    roster: {
      starters: {
        PG: "parketo01-SAS-2010s", // Tony Parker
        SG: "ginobma01-SAS-2010s", // Manu Ginóbili
        SF: "leonaka01-SAS-2010s", // Kawhi Leonard
        PF: "duncati01-SAS-2010s", // Tim Duncan
        C:  "gasolpa01-SAS-2010s", // Pau Gasol
      },
      bench: [
        "derozde01-SAS-2010s",  // DeMar DeRozan
        "aldrila01-SAS-2010s",  // LaMarcus Aldridge
        "hillge01-SAS-2010s",   // George Hill
      ],
    },
  },
  {
    slug: "famous-04-pistons",
    name: "'04 Pistons",
    era: "2003–04",
    blurb: "Goin' to Work. No superstars — just a champion defense.",
    roster: {
      starters: {
        PG: "billuch01-DET-2000s", // Chauncey Billups
        SG: "hamilri01-DET-2000s", // Richard Hamilton
        SF: "princta01-DET-2000s", // Tayshaun Prince
        PF: "wallara01-DET-2000s", // Rasheed Wallace
        C:  "robincl02-DET-2000s", // Clifford Robinson
      },
      bench: [
        "hillgr01-DET-2000s",   // Grant Hill
        "iversal01-DET-2000s",  // Allen Iverson
        "stuckro01-DET-2000s",  // Rodney Stuckey
      ],
    },
  },
  {
    slug: "famous-12-thunder",
    name: "'12 Thunder",
    era: "2011–12",
    blurb: "KD, Westbrook, and Harden — the young core that reached the Finals.",
    roster: {
      starters: {
        PG: "westbru01-OKC-2010s", // Russell Westbrook
        SG: "hardeja01-OKC-2010s", // James Harden
        SF: "duranke01-OKC-2010s", // Kevin Durant
        PF: "ibakase01-OKC-2010s", // Serge Ibaka
        C:  "kanteen01-OKC-2010s", // Enes Kanter
      },
      bench: [
        "georgpa01-OKC-2010s",  // Paul George
        "anthoca01-OKC-2010s",  // Carmelo Anthony
        "schrode01-OKC-2010s",  // Dennis Schröder
      ],
    },
  },
  {
    slug: "famous-23-nuggets",
    name: "'23 Nuggets",
    era: "2022–23",
    blurb: "Jokić's coronation — Denver's first title behind a two-time MVP.",
    roster: {
      starters: {
        PG: "murraja01-DEN-2020s", // Jamal Murray
        SG: "braunch01-DEN-2020s", // Christian Braun
        SF: "portemi01-DEN-2020s", // Michael Porter Jr.
        PF: "gordoaa01-DEN-2020s", // Aaron Gordon
        C:  "jokicni01-DEN-2020s", // Nikola Jokić
      },
      bench: [
        "bartowi01-DEN-2020s",  // Will Barton
        "hardati02-DEN-2020s",  // Tim Hardaway Jr.
        "morrimo01-DEN-2020s",  // Monte Morris
      ],
    },
  },
  {
    slug: "famous-21-bucks",
    name: "'21 Bucks",
    era: "2020–21",
    blurb: "Giannis closes it out — 50 in the clincher. Bucks in six.",
    roster: {
      starters: {
        PG: "holidjr01-MIL-2020s", // Jrue Holiday
        SG: "lillada01-MIL-2020s", // Damian Lillard
        SF: "middlkh01-MIL-2020s", // Khris Middleton
        PF: "antetgi01-MIL-2020s", // Giannis Antetokounmpo
        C:  "lopezbr01-MIL-2020s", // Brook Lopez
      },
      bench: [
        "portibo01-MIL-2020s",  // Bobby Portis
        "bledser01-MIL-2020s",  // Eric Bledsoe
        "turnemy01-MIL-2020s",  // Myles Turner
      ],
    },
  },
  {
    slug: "famous-93-suns",
    name: "'93 Suns",
    era: "1992–93",
    blurb: "MVP Barkley's run to the Finals. Sir Charles in his prime.",
    roster: {
      starters: {
        PG: "johnske02-PHX-1990s", // Kevin Johnson
        SG: "hornaje01-PHX-1990s", // Jeff Hornacek
        SF: "majerda01-PHX-1990s", // Dan Majerle
        PF: "barklch01-PHX-1990s", // Charles Barkley
        C:  "mannida01-PHX-1990s", // Danny Manning
      },
      bench: [
        "chambto01-PHX-1990s",  // Tom Chambers
        "cebalce01-PHX-1990s",  // Cedric Ceballos
        "kiddja01-PHX-1990s",   // Jason Kidd
      ],
    },
  },
  {
    slug: "famous-72-lakers",
    name: "'72 Lakers",
    era: "1971–72",
    blurb: "33 straight wins — the longest streak in NBA history.",
    roster: {
      starters: {
        PG: "westje01-LAL-1970s",   // Jerry West
        SG: "goodrga01-LAL-1970s",  // Gail Goodrich
        SF: "bayloel01-LAL-1970s",  // Elgin Baylor
        PF: "hairsha01-LAL-1970s",  // Happy Hairston
        C:  "chambwi01-LAL-1970s",  // Wilt Chamberlain
      },
      bench: [
        "mcmilji01-LAL-1970s",  // Jim McMillian
        "allenlu01-LAL-1970s",  // Lucius Allen
        "wilkeja01-LAL-1970s",  // Jamaal Wilkes
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

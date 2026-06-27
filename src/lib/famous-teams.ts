/**
 * Budget Matchups — curated famous historical team presets.
 *
 * Each entry defines a 6-man roster (5 starters + 1 bench), matching the budget
 * draft roster size, using real player IDs from public/data/snapshot-v1.json.
 * These are seeded as preset Team rows via scripts/seed-famous.ts and used as
 * opponents in Budget Matchups via the standard POST /api/matchups path.
 *
 * Roster accuracy: every listed player was an actual member of that exact title
 * team. Player IDs follow `{bbref_slug}-{franchise}-{decade}`, and the dataset
 * has one row per player per franchise per decade keyed to that player's PEAK
 * season in the decade — so stats are best-available, not the precise title-year
 * line (there is no per-season data in snapshot-v1). For each player we pick the
 * franchise×decade id whose peak season sits closest to the title year.
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
  /** 6-man roster (5 starters + 1 bench). */
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
        PG: "harpero01-CHI-1990s", // Ron Harper
        SG: "jordami01-CHI-1990s", // Michael Jordan
        SF: "pippesc01-CHI-1990s", // Scottie Pippen
        PF: "rodmade01-CHI-1990s", // Dennis Rodman
        C:  "longllu01-CHI-1990s", // Luc Longley
      },
      bench: [
        "kukocto01-CHI-1990s"  // Toni Kukoč (1996 Sixth Man of the Year)
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
        "waltobi01-BOS-1980s"  // Bill Walton (1986 Sixth Man of the Year)
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
        "coopemi01-LAL-1980s"  // Michael Cooper (1987 Defensive Player of the Year)
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
        PG: "harpero01-LAL-2000s", // Ron Harper
        SG: "bryanko01-LAL-2000s", // Kobe Bryant
        SF: "ricegl01-LAL-2000s",  // Glen Rice
        PF: "horryro01-LAL-2000s", // Robert Horry
        C:  "onealsh01-LAL-2000s", // Shaquille O'Neal
      },
      bench: [
        "fishede01-LAL-2000s"  // Derek Fisher
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
        "lucasje01-NYK-1970s"  // Jerry Lucas
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
        PG: "smithke01-HOU-1990s", // Kenny Smith
        SG: "drexlcl01-HOU-1990s", // Clyde Drexler
        SF: "horryro01-HOU-1990s", // Robert Horry
        PF: "herreca01-HOU-1990s", // Carl Herrera
        C:  "olajuha01-HOU-1990s", // Hakeem Olajuwon
      },
      bench: [
        "cassesa01-HOU-1990s"  // Sam Cassell
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
        PG: "curryst01-GSW-2010s", // Stephen Curry
        SG: "thompkl01-GSW-2010s", // Klay Thompson
        SF: "duranke01-GSW-2010s", // Kevin Durant
        PF: "greendr01-GSW-2010s", // Draymond Green
        C:  "pachuza01-GSW-2010s", // Zaza Pachulia
      },
      bench: [
        "iguodan01-GSW-2010s"  // Andre Iguodala (2015 Finals MVP)
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
        PG: "chalmma01-MIA-2010s", // Mario Chalmers
        SG: "wadedw01-MIA-2010s",  // Dwyane Wade
        SF: "jamesle01-MIA-2010s", // LeBron James
        PF: "battish01-MIA-2010s", // Shane Battier
        C:  "boshch01-MIA-2010s",  // Chris Bosh
      },
      bench: [
        "allenra02-MIA-2010s"  // Ray Allen
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
        SF: "bowenbr01-SAS-2000s", // Bruce Bowen
        PF: "duncati01-SAS-2000s", // Tim Duncan
        C:  "nestera01-SAS-2000s", // Rasho Nesterović
      },
      bench: [
        "horryro01-SAS-2000s"  // Robert Horry
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
        SF: "russebr01-UTA-1990s", // Bryon Russell
        PF: "malonka01-UTA-1990s", // Karl Malone (1997 MVP)
        C:  "ostergr01-UTA-1990s", // Greg Ostertag
      },
      bench: [
        "carran01-UTA-1990s"  // Antoine Carr
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
        SG: "dumarjo01-DET-1980s", // Joe Dumars (1989 Finals MVP)
        SF: "dantlad01-DET-1980s", // Adrian Dantley
        PF: "rodmade01-DET-1980s", // Dennis Rodman
        C:  "laimbbi01-DET-1980s", // Bill Laimbeer
      },
      bench: [
        "johnsvi01-DET-1980s"  // Vinnie "the Microwave" Johnson
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
        PF: "jonesbo01-PHI-1980s", // Bobby Jones (1983 Sixth Man of the Year)
        C:  "malonmo01-PHI-1980s", // Moses Malone (1983 MVP)
      },
      bench: [
        "richacl01-PHI-1980s"  // Clint Richardson
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
        SF: "piercpa01-BOS-2000s", // Paul Pierce (2008 Finals MVP)
        PF: "garneke01-BOS-2000s", // Kevin Garnett
        C:  "perkike01-BOS-2000s", // Kendrick Perkins
      },
      bench: [
        "poseyja01-BOS-2000s"  // James Posey
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
        SG: "smithjr01-CLE-2010s", // J.R. Smith
        SF: "jamesle01-CLE-2010s", // LeBron James (2016 Finals MVP)
        PF: "loveke01-CLE-2010s",  // Kevin Love
        C:  "thomptr01-CLE-2010s", // Tristan Thompson
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
        SG: "greenda02-SAS-2010s", // Danny Green
        SF: "leonaka01-SAS-2010s", // Kawhi Leonard (2014 Finals MVP)
        PF: "duncati01-SAS-2010s", // Tim Duncan
        C:  "splitti01-SAS-2010s", // Tiago Splitter
      },
      bench: [
        "ginobma01-SAS-2010s"  // Manu Ginóbili
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
        PG: "billuch01-DET-2000s", // Chauncey Billups (2004 Finals MVP)
        SG: "hamilri01-DET-2000s", // Richard Hamilton
        SF: "princta01-DET-2000s", // Tayshaun Prince
        PF: "wallara01-DET-2000s", // Rasheed Wallace
        C:  "wallabe01-DET-2000s", // Ben Wallace
      },
      bench: [
        "willico02-DET-2000s"  // Corliss Williamson
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
        SG: "sefolth01-OKC-2010s", // Thabo Sefolosha
        SF: "duranke01-OKC-2010s", // Kevin Durant
        PF: "ibakase01-OKC-2010s", // Serge Ibaka
        C:  "perkike01-OKC-2010s", // Kendrick Perkins
      },
      bench: [
        "hardeja01-OKC-2010s"  // James Harden (2012 Sixth Man of the Year)
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
        SG: "caldwke01-DEN-2020s", // Kentavious Caldwell-Pope
        SF: "portemi01-DEN-2020s", // Michael Porter Jr.
        PF: "gordoaa01-DEN-2020s", // Aaron Gordon
        C:  "jokicni01-DEN-2020s", // Nikola Jokić (2023 Finals MVP)
      },
      bench: [
        "brownbr01-DEN-2020s"  // Bruce Brown
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
        SG: "divindo01-MIL-2020s", // Donte DiVincenzo
        SF: "middlkh01-MIL-2020s", // Khris Middleton
        PF: "antetgi01-MIL-2020s", // Giannis Antetokounmpo (2021 Finals MVP)
        C:  "lopezbr01-MIL-2020s", // Brook Lopez
      },
      bench: [
        "portibo01-MIL-2020s"  // Bobby Portis
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
        SG: "majerda01-PHX-1990s", // Dan Majerle
        SF: "dumasri02-PHX-1990s", // Richard Dumas
        PF: "barklch01-PHX-1990s", // Charles Barkley (1993 MVP)
        C:  "westma01-PHX-1990s",  // Mark West
      },
      bench: [
        "cebalce01-PHX-1990s"  // Cedric Ceballos
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
        SF: "mcmilji01-LAL-1970s",  // Jim McMillian
        PF: "hairsha01-LAL-1970s",  // Happy Hairston
        C:  "chambwi01-LAL-1970s",  // Wilt Chamberlain
      },
      bench: [
        "erickke01-LAL-1970s"  // Keith Erickson
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

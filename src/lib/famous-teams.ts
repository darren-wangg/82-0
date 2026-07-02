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
  {
    slug: "famous-99-spurs",
    name: "'99 Spurs",
    era: "1998–99",
    blurb: "The Twin Towers win San Antonio's first title.",
    roster: {
      starters: {
        PG: "johnsav01-SAS-1990s", // Avery Johnson
        SG: "eliema01-SAS-1990s",  // Mario Elie
        SF: "elliose01-SAS-1990s", // Sean Elliott
        PF: "duncati01-SAS-1990s", // Tim Duncan (1999 Finals MVP)
        C:  "robinda01-SAS-1990s", // David Robinson
      },
      bench: [
        "jacksja01-SAS-1990s"  // Jaren Jackson
      ],
    },
  },
  {
    slug: "famous-77-blazers",
    name: "'77 Blazers",
    era: "1976–77",
    blurb: "Bill Walton's Blazermania crowns Portland.",
    roster: {
      starters: {
        PG: "hollili01-POR-1970s", // Lionel Hollins
        SG: "twardda01-POR-1970s", // Dave Twardzik
        SF: "grossbo01-POR-1970s", // Bob Gross
        PF: "lucasma01-POR-1970s", // Maurice Lucas
        C:  "waltobi01-POR-1970s", // Bill Walton (1977 Finals MVP)
      },
      bench: [
        "davisjo01-POR-1970s"  // Johnny Davis
      ],
    },
  },
  {
    slug: "famous-71-bucks",
    name: "'71 Bucks",
    era: "1970–71",
    blurb: "Kareem and Oscar romp to Milwaukee's lone title.",
    roster: {
      starters: {
        PG: "roberos01-MIL-1970s", // Oscar Robertson
        SG: "mcglojo01-MIL-1970s", // Jon McGlocklin
        SF: "dandrbo01-MIL-1970s", // Bob Dandridge
        PF: "smithgr01-MIL-1970s", // Greg Smith
        C:  "abdulka01-MIL-1970s", // Kareem Abdul-Jabbar (1971 MVP)
      },
      bench: [
        "boozebo01-MIL-1970s"  // Bob Boozer
      ],
    },
  },
  {
    slug: "famous-19-raptors",
    name: "'19 Raptors",
    era: "2018–19",
    blurb: "Kawhi's one-year reign brings Toronto a crown.",
    roster: {
      starters: {
        PG: "lowryky01-TOR-2010s", // Kyle Lowry
        SG: "greenda02-TOR-2010s", // Danny Green
        SF: "leonaka01-TOR-2010s", // Kawhi Leonard (2019 Finals MVP)
        PF: "siakapa01-TOR-2010s", // Pascal Siakam
        C:  "ibakase01-TOR-2010s", // Serge Ibaka
      },
      bench: [
        "vanvlfr01-TOR-2010s"  // Fred VanVleet
      ],
    },
  },
  {
    slug: "famous-11-mavericks",
    name: "'11 Mavericks",
    era: "2010–11",
    blurb: "Dirk outduels the Heat's Big Three.",
    roster: {
      starters: {
        PG: "kiddja01-DAL-2010s",  // Jason Kidd
        SG: "terryja01-DAL-2010s", // Jason Terry
        SF: "mariosh01-DAL-2010s", // Shawn Marion
        PF: "nowitdi01-DAL-2010s", // Dirk Nowitzki (2011 Finals MVP)
        C:  "chandty01-DAL-2010s", // Tyson Chandler
      },
      bench: [
        "bareajo01-DAL-2010s"  // J.J. Barea
      ],
    },
  },
  {
    slug: "famous-24-celtics",
    name: "'24 Celtics",
    era: "2023–24",
    blurb: "Tatum and Brown raise banner 18.",
    roster: {
      starters: {
        PG: "holidjr01-BOS-2020s", // Jrue Holiday
        SG: "whitede01-BOS-2020s", // Derrick White
        SF: "brownja02-BOS-2020s", // Jaylen Brown (2024 Finals MVP)
        PF: "tatumja01-BOS-2020s", // Jayson Tatum
        C:  "porzikr01-BOS-2020s", // Kristaps Porziņģis
      },
      bench: [
        "horfoal01-BOS-2020s"  // Al Horford
      ],
    },
  },
  {
    slug: "famous-06-heat",
    name: "'06 Heat",
    era: "2005–06",
    blurb: "Wade and Shaq deliver Miami's first title.",
    roster: {
      starters: {
        PG: "willija02-MIA-2000s", // Jason Williams
        SG: "wadedw01-MIA-2000s",  // Dwyane Wade (2006 Finals MVP)
        SF: "walkean02-MIA-2000s", // Antoine Walker
        PF: "hasleud01-MIA-2000s", // Udonis Haslem
        C:  "onealsh01-MIA-2000s", // Shaquille O'Neal
      },
      bench: [
        "mournal01-MIA-2000s"  // Alonzo Mourning
      ],
    },
  },
  {
    slug: "famous-67-sixers",
    name: "'67 76ers",
    era: "1966–67",
    blurb: "A 68-win Wilt machine, long the gold standard.",
    roster: {
      starters: {
        PG: "joneswa02-PHI-1960s", // Wali Jones
        SG: "greerha01-PHI-1960s", // Hal Greer
        SF: "walkech01-PHI-1960s", // Chet Walker
        PF: "jackslu01-PHI-1960s", // Luke Jackson
        C:  "chambwi01-PHI-1960s", // Wilt Chamberlain (1967 MVP)
      },
      bench: [
        "cunnibi01-PHI-1960s"  // Billy Cunningham
      ],
    },
  },
  {
    slug: "famous-65-celtics",
    name: "'65 Celtics",
    era: "1964–65",
    blurb: "Russell's dynasty at its dominant peak.",
    roster: {
      starters: {
        PG: "joneskc01-BOS-1960s", // K.C. Jones
        SG: "jonessa01-BOS-1960s", // Sam Jones
        SF: "heinsto01-BOS-1960s", // Tom Heinsohn
        PF: "sandeto01-BOS-1960s", // Tom Sanders
        C:  "russebi01-BOS-1960s", // Bill Russell (1965 MVP)
      },
      bench: [
        "havlijo01-BOS-1960s"  // John Havlicek
      ],
    },
  },
  {
    slug: "famous-20-lakers",
    name: "'20 Lakers",
    era: "2019–20",
    blurb: "LeBron and AD win it in the bubble.",
    roster: {
      starters: {
        PG: "rondora01-LAL-2020s", // Rajon Rondo
        SG: "greenda02-LAL-2020s", // Danny Green
        SF: "jamesle01-LAL-2020s", // LeBron James (2020 Finals MVP)
        PF: "davisan02-LAL-2020s", // Anthony Davis
        C:  "howardw01-LAL-2020s", // Dwight Howard
      },
      bench: [
        "caldwke01-LAL-2020s"  // Kentavious Caldwell-Pope
      ],
    },
  },
];

/** Quick lookup by slug. */
export const FAMOUS_TEAM_BY_SLUG = new Map(
  FAMOUS_TEAMS.map((t) => [t.slug, t])
);

/**
 * Two extra bench players per team, used to fill a famous roster out to 8 men
 * (5 starters + 3 bench) for the 8-player budget mode. Same dataset caveat as
 * the 6-man set above: each id is a real member of that franchise in that era,
 * picked for best-available stats — not a precise title-year box score.
 *
 * Keyed by the 6-man slug; the 8-man roster is `starters + bench + these`.
 */
export const BENCH8_ADDITIONS: Record<string, [string, string]> = {
  "famous-96-bulls":    ["kerrst01-CHI-1990s", "wennibi01-CHI-1990s"], // Steve Kerr, Bill Wennington
  "famous-86-celtics":  ["wedmasc01-BOS-1980s", "sichtje01-BOS-1980s"], // Scott Wedman, Jerry Sichting
  "famous-87-lakers":   ["rambiku01-LAL-1980s", "thompmy01-LAL-1980s"], // Kurt Rambis, Mychal Thompson
  "famous-00-lakers":   ["foxri01-LAL-2000s", "georgde01-LAL-2000s"],   // Rick Fox, Devean George
  "famous-73-knicks":   ["jacksph01-NYK-1970s", "barnedi01-NYK-1970s"], // Phil Jackson, Dick Barnett
  "famous-95-rockets":  ["eliema01-HOU-1990s", "brownch01-HOU-1990s"],  // Mario Elie, Chucky Brown
  "famous-17-warriors": ["westda01-GSW-2010s", "looneke01-GSW-2010s"],  // David West, Kevon Looney
  "famous-13-heat":     ["anderch01-MIA-2010s", "hasleud01-MIA-2010s"], // Chris Andersen, Udonis Haslem
  "famous-05-spurs":    ["barrybr01-SAS-2000s", "mohamna01-SAS-2000s"], // Brent Barry, Nazr Mohammed
  "famous-97-jazz":     ["andersh01-UTA-1990s", "eisleho01-UTA-1990s"], // Shandon Anderson, Howard Eisley
  "famous-89-pistons":  ["sallejo01-DET-1980s", "mahorri01-DET-1980s"], // John Salley, Rick Mahorn
  "famous-83-sixers":   ["jonesca01-PHI-1980s", "mixst01-PHI-1980s"],   // Caldwell Jones, Steve Mix
  "famous-08-celtics":  ["battito01-BOS-2000s", "gomesry01-BOS-2000s"], // Tony Battie, Ryan Gomes
  "famous-16-cavs":     ["mozgoti01-CLE-2010s", "varejan01-CLE-2010s"], // Timofey Mozgov, Anderson Varejão
  "famous-14-spurs":    ["millspa02-SAS-2010s", "diawbo01-SAS-2010s"],  // Patty Mills, Boris Diaw
  "famous-04-pistons":  ["okurme01-DET-2000s", "hunteli01-DET-2000s"],  // Mehmet Okur, Lindsey Hunter
  "famous-12-thunder":  ["collini01-OKC-2010s", "jacksre01-OKC-2010s"], // Nick Collison, Reggie Jackson
  "famous-23-nuggets":  ["braunch01-DEN-2020s", "greenje02-DEN-2020s"], // Christian Braun, Jeff Green
  "famous-21-bucks":    ["connapa01-MIL-2020s", "forbebr01-MIL-2020s"], // Pat Connaughton, Bryn Forbes
  "famous-93-suns":     ["aingeda01-PHX-1990s", "chambto01-PHX-1990s"], // Danny Ainge, Tom Chambers
  "famous-72-lakers":   ["bayloel01-LAL-1970s", "garredi01-LAL-1970s"], // Elgin Baylor, Dick Garrett
  "famous-99-spurs":    ["perduwi01-SAS-1990s", "delnevi01-SAS-1990s"], // Will Perdue, Vinny Del Negro
  "famous-77-blazers":  ["steella01-POR-1970s", "nealll01-POR-1970s"],  // Larry Steele, Lloyd Neal
  "famous-71-bucks":    ["allenlu01-MIL-1970s", "abdulza01-MIL-1970s"], // Lucius Allen, Zaid Abdul-Aziz
  "famous-19-raptors":  ["valanjo01-TOR-2010s", "wrighde01-TOR-2010s"], // Jonas Valančiūnas, Delon Wright
  "famous-11-mavericks":["cartevi01-DAL-2010s", "goodedr01-DAL-2010s"], // Vince Carter, Drew Gooden
  "famous-24-celtics":  ["pritcpa01-BOS-2020s", "hausesa01-BOS-2020s"], // Payton Pritchard, Sam Hauser
  "famous-06-heat":     ["jonesed02-MIA-2000s", "jonesda01-MIA-2000s"], // Eddie Jones, Damon Jones
  "famous-67-sixers":   ["costela01-PHI-1960s", "guokama02-PHI-1960s"], // Larry Costello, Matt Guokas
  "famous-65-celtics":  ["siegfla01-BOS-1960s", "ramsefr01-BOS-1960s"], // Larry Siegfried, Frank Ramsey
  "famous-20-lakers":   ["kuzmaky01-LAL-2020s", "mcgeeja01-LAL-2020s"], // Kyle Kuzma, JaVale McGee
};

/**
 * Two more bench players per team, filling a famous roster out to 10 men
 * (5 starters + 5 bench) for the 10-player budget mode. Curated the same way
 * as BENCH8_ADDITIONS: real members of that franchise in that era (actual
 * champions where the snapshot pool allows, era-adjacent teammates otherwise).
 *
 * Keyed by the base slug; the 10-man roster is `8-man roster + these`.
 */
export const BENCH10_ADDITIONS: Record<string, [string, string]> = {
  "famous-96-bulls":    ["brownra02-CHI-1990s", "caffeja01-CHI-1990s"],   // Randy Brown, Jason Caffey
  "famous-86-celtics":  ["maxwece01-BOS-1980s", "lewisre01-BOS-1980s"],   // Cedric Maxwell, Reggie Lewis
  "famous-87-lakers":   ["wilkeja01-LAL-1980s", "mcadobo01-LAL-1980s"],   // Jamaal Wilkes, Bob McAdoo
  "famous-00-lakers":   ["grantho01-LAL-2000s", "walkesa01-LAL-2000s"],   // Horace Grant, Samaki Walker
  "famous-73-knicks":   ["meminde01-NYK-1970s", "gianejo01-NYK-1970s"],   // Dean Meminger, John Gianelli
  "famous-95-rockets":  ["thorpot01-HOU-1990s", "maxweve01-HOU-1990s"],   // Otis Thorpe, Vernon Maxwell
  "famous-17-warriors": ["bogutan01-GSW-2010s", "leeda02-GSW-2010s"],     // Andrew Bogut, David Lee
  "famous-13-heat":     ["beaslmi01-MIA-2010s", "denglu01-MIA-2010s"],    // Michael Beasley, Luol Deng
  "famous-05-spurs":    ["brownde02-SAS-2000s", "rosema01-SAS-2000s"],    // Devin Brown, Malik Rose
  "famous-97-jazz":     ["keefead01-UTA-1990s", "morrich01-UTA-1990s"],   // Adam Keefe, Chris Morris
  "famous-89-pistons":  ["longjo01-DET-1980s", "tripuke01-DET-1980s"],    // John Long, Kelly Tripucka
  "famous-83-sixers":   ["dawkida01-PHI-1980s", "hollili01-PHI-1980s"],   // Darryl Dawkins, Lionel Hollins
  "famous-08-celtics":  ["jeffeal01-BOS-2000s", "westde01-BOS-2000s"],    // Al Jefferson, Delonte West
  "famous-16-cavs":     ["greenje02-CLE-2010s", "clarkjo01-CLE-2010s"],   // Jeff Green, Jordan Clarkson
  "famous-14-spurs":    ["belinma01-SAS-2010s", "anderky01-SAS-2010s"],   // Marco Belinelli, Kyle Anderson
  "famous-04-pistons":  ["mcdyean01-DET-2000s", "stackje01-DET-2000s"],   // Antonio McDyess, Jerry Stackhouse
  "famous-12-thunder":  ["martike02-OKC-2010s", "adamsst01-OKC-2010s"],   // Kevin Martin, Steven Adams
  "famous-23-nuggets":  ["watsope01-DEN-2020s", "morrimo01-DEN-2020s"],   // Peyton Watson, Monte Morris
  "famous-21-bucks":    ["bledser01-MIL-2020s", "allengr01-MIL-2020s"],   // Eric Bledsoe, Grayson Allen
  "famous-93-suns":     ["milleol01-PHX-1990s", "hornaje01-PHX-1990s"],   // Oliver Miller, Jeff Hornacek
  "famous-72-lakers":   ["bridgbi01-LAL-1970s", "hawkico01-LAL-1970s"],   // Bill Bridges, Connie Hawkins
  "famous-99-spurs":    ["carran01-SAS-1990s", "cummite01-SAS-1990s"],    // Antoine Carr, Terry Cummings
  "famous-77-blazers":  ["wickssi01-POR-1970s", "petrige01-POR-1970s"],   // Sidney Wicks, Geoff Petrie
  "famous-71-bucks":    ["robinfl01-MIL-1970s", "perrycu01-MIL-1970s"],   // Flynn Robinson, Curtis Perry
  "famous-19-raptors":  ["derozde01-TOR-2010s", "johnsam01-TOR-2010s"],   // DeMar DeRozan, Amir Johnson
  "famous-11-mavericks":["ellismo01-DAL-2010s", "caldejo01-DAL-2010s"],   // Monta Ellis, José Calderón
  "famous-24-celtics":  ["kornelu01-BOS-2020s", "quetane01-BOS-2020s"],   // Luke Kornet, Neemias Queta
  "famous-06-heat":     ["kaponja01-MIA-2000s", "mariosh01-MIA-2000s"],   // Jason Kapono, Shawn Marion
  "famous-67-sixers":   ["gambeda01-PHI-1960s", "clarkar01-PHI-1960s"],   // Dave Gambee, Archie Clark
  "famous-65-celtics":  ["naullwi01-BOS-1960s", "countme01-BOS-1960s"],   // Willie Naulls, Mel Counts
  "famous-20-lakers":   ["hortota01-LAL-2020s", "schrode01-LAL-2020s"],   // Talen Horton-Tucker, Dennis Schröder
};

/**
 * The DB slug for a famous team's preset row at a given roster size. Sizes
 * follow the global 5 / 8 / 10 preference; unknown sizes fall back to 8.
 * (Base, unsuffixed slugs are legacy 6-man rows no longer addressed.)
 */
export function famousSlugForSize(slug: string, size: number): string {
  return size === 5 || size === 10 ? `${slug}-${size}` : `${slug}-8`;
}

/**
 * The famous team's roster at a given size: 5 → the curated starting five,
 * 8 → + curated 6th man + BENCH8_ADDITIONS, 10 → the 8-man roster +
 * BENCH10_ADDITIONS. Unknown sizes fall back to 8.
 */
export function famousRosterForSize(team: FamousTeam, size: number): Roster {
  if (size === 5) return { starters: team.roster.starters, bench: [] };
  const bench8 = [
    ...team.roster.bench,
    ...(BENCH8_ADDITIONS[team.slug] ?? []),
  ];
  return {
    starters: team.roster.starters,
    bench:
      size === 10
        ? [...bench8, ...(BENCH10_ADDITIONS[team.slug] ?? [])]
        : bench8,
  };
}

/**
 * The franchise behind a famous team (every preset is a single franchise×decade
 * composite). Parsed from a roster id (`{bbref}-{franchiseId}-{decade}`) so the
 * team logo can be looked up without an extra field on every entry.
 */
export function famousTeamFranchise(team: FamousTeam): string {
  return team.roster.starters.C.split("-")[1];
}

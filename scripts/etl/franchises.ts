/**
 * Franchise normalization: every Basketball-Reference team code seen since
 * 1960 (NBA + ABA) mapped to its canonical modern franchise id, following the
 * NBA's official franchise lineages:
 *
 * - Philadelphia/San Francisco Warriors -> GSW
 * - Rochester/Cincinnati Royals, KC-Omaha/KC Kings -> SAC
 * - Seattle SuperSonics -> OKC
 * - New York/New Jersey Nets (incl. ABA Americans/Nets) -> BKN
 * - Syracuse Nationals -> PHI
 * - Minneapolis Lakers -> LAL
 * - St. Louis Hawks -> ATL
 * - Chicago Packers/Zephyrs, Baltimore/Capital/Washington Bullets -> WAS
 * - San Diego Rockets -> HOU
 * - Buffalo Braves, San Diego Clippers -> LAC
 * - New Orleans Jazz -> UTA
 * - Vancouver Grizzlies -> MEM
 * - Charlotte Hornets 1989-2002 + Bobcats -> CHA (NBA official lineage)
 * - New Orleans Hornets/OKC Hornets -> NOP (treated as 2002 expansion)
 * - ABA survivors: Denver Rockets/Nuggets -> DEN, Indiana Pacers -> IND,
 *   Dallas Chaparrals/Texas Chaparrals/San Antonio Spurs -> SAS
 *
 * Defunct ABA teams with no NBA successor (Kentucky, Virginia, Spirits, etc.)
 * are intentionally unmapped and excluded from the snapshot.
 */

export const FRANCHISE_NAMES: Record<string, string> = {
  ATL: "Atlanta Hawks",
  BOS: "Boston Celtics",
  BKN: "Brooklyn Nets",
  CHA: "Charlotte Hornets",
  CHI: "Chicago Bulls",
  CLE: "Cleveland Cavaliers",
  DAL: "Dallas Mavericks",
  DEN: "Denver Nuggets",
  DET: "Detroit Pistons",
  GSW: "Golden State Warriors",
  HOU: "Houston Rockets",
  IND: "Indiana Pacers",
  LAC: "Los Angeles Clippers",
  LAL: "Los Angeles Lakers",
  MEM: "Memphis Grizzlies",
  MIA: "Miami Heat",
  MIL: "Milwaukee Bucks",
  MIN: "Minnesota Timberwolves",
  NOP: "New Orleans Pelicans",
  NYK: "New York Knicks",
  OKC: "Oklahoma City Thunder",
  ORL: "Orlando Magic",
  PHI: "Philadelphia 76ers",
  PHX: "Phoenix Suns",
  POR: "Portland Trail Blazers",
  SAC: "Sacramento Kings",
  SAS: "San Antonio Spurs",
  TOR: "Toronto Raptors",
  UTA: "Utah Jazz",
  WAS: "Washington Wizards",
};

/** BBR team code (NBA or ABA, 1960+) -> canonical modern franchise id. */
export const TEAM_TO_FRANCHISE: Record<string, string> = {
  // Hawks
  STL: "ATL",
  ATL: "ATL",
  // Celtics
  BOS: "BOS",
  // Nets (NBA + ABA New Jersey Americans / New York Nets)
  NJA: "BKN",
  NYA: "BKN",
  NYN: "BKN",
  NJN: "BKN",
  BRK: "BKN",
  // Hornets (incl. original Charlotte Hornets and Bobcats)
  CHH: "CHA",
  CHA: "CHA",
  CHO: "CHA",
  // Bulls
  CHI: "CHI",
  // Cavaliers
  CLE: "CLE",
  // Mavericks
  DAL: "DAL",
  // Nuggets (incl. ABA Denver Rockets / Nuggets)
  DNR: "DEN",
  DNA: "DEN",
  DEN: "DEN",
  // Pistons
  DET: "DET",
  // Warriors
  PHW: "GSW",
  SFW: "GSW",
  GSW: "GSW",
  // Rockets
  SDR: "HOU",
  HOU: "HOU",
  // Pacers (incl. ABA)
  INA: "IND",
  IND: "IND",
  // Clippers (Buffalo Braves, San Diego Clippers)
  BUF: "LAC",
  SDC: "LAC",
  LAC: "LAC",
  // Lakers
  MNL: "LAL",
  LAL: "LAL",
  // Grizzlies
  VAN: "MEM",
  MEM: "MEM",
  // Heat
  MIA: "MIA",
  // Bucks
  MIL: "MIL",
  // Timberwolves
  MIN: "MIN",
  // Pelicans (New Orleans / Oklahoma City Hornets era)
  NOH: "NOP",
  NOK: "NOP",
  NOP: "NOP",
  // Knicks
  NYK: "NYK",
  // Thunder (Seattle SuperSonics)
  SEA: "OKC",
  OKC: "OKC",
  // Magic
  ORL: "ORL",
  // 76ers (Syracuse Nationals)
  SYR: "PHI",
  PHI: "PHI",
  // Suns (BBR uses PHO)
  PHO: "PHX",
  // Trail Blazers
  POR: "POR",
  // Kings (Cincinnati Royals, KC-Omaha / Kansas City Kings)
  CIN: "SAC",
  KCO: "SAC",
  KCK: "SAC",
  SAC: "SAC",
  // Spurs (incl. ABA Dallas/Texas Chaparrals)
  DLC: "SAS",
  TEX: "SAS",
  SAA: "SAS",
  SAS: "SAS",
  // Raptors
  TOR: "TOR",
  // Jazz (New Orleans Jazz)
  NOJ: "UTA",
  UTA: "UTA",
  // Wizards (Chicago Packers/Zephyrs, Baltimore/Capital/Washington Bullets)
  CHP: "WAS",
  CHZ: "WAS",
  BAL: "WAS",
  CAP: "WAS",
  WSB: "WAS",
  WAS: "WAS",
};

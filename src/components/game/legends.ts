/**
 * Legendary "jackpot" pulls — a curated top-25-of-all-time list, keyed by the
 * full stat-line id (player-franchise-decade) so only each legend's PEAK form
 * lights up: LAL-2000s Shaq is a jackpot, Cavs Shaq is just a guy. One line
 * per legend, picked by engine playerScore over snapshot-v1 and sanity-checked
 * against canon (e.g. Dr. J's ABA Nets peak, Wilt's 50-a-game Warriors year).
 */

import type { PlayerStatLine } from "@/lib/contracts";

export const LEGEND_IDS: ReadonlySet<string> = new Set([
  "jordami01-CHI-1980s", // Michael Jordan — 37-a-game, MVP+DPOY Bulls
  "jamesle01-MIA-2010s", // LeBron James — Heatles back-to-back
  "abdulka01-MIL-1970s", // Kareem Abdul-Jabbar — Bucks MVP run
  "johnsma02-LAL-1980s", // Magic Johnson — Showtime
  "birdla01-BOS-1980s", // Larry Bird — 3 straight MVPs
  "chambwi01-GSW-1960s", // Wilt Chamberlain — 50.4 a game
  "russebi01-BOS-1960s", // Bill Russell — 11 rings
  "duncati01-SAS-2000s", // Tim Duncan — back-to-back MVPs
  "bryanko01-LAL-2000s", // Kobe Bryant — 81 and the MVP year
  "onealsh01-LAL-2000s", // Shaquille O'Neal — three-peat dominance
  "olajuha01-HOU-1990s", // Hakeem Olajuwon — MVP + 2 titles
  "curryst01-GSW-2010s", // Stephen Curry — unanimous MVP
  "duranke01-OKC-2010s", // Kevin Durant — scoring-title MVP form
  "antetgi01-MIL-2010s", // Giannis Antetokounmpo — MVP leap
  "jokicni01-DEN-2020s", // Nikola Jokić — MVP triptych
  "nowitdi01-DAL-2000s", // Dirk Nowitzki — MVP year
  "roberos01-SAC-1960s", // Oscar Robertson — triple-double season (Royals)
  "westje01-LAL-1960s", // Jerry West — The Logo
  "ervinju01-BKN-1970s", // Julius Erving — ABA Nets Dr. J
  "malonmo01-PHI-1980s", // Moses Malone — fo' fi' fo'
  "garneke01-MIN-2000s", // Kevin Garnett — MVP Wolves
  "malonka01-UTA-1990s", // Karl Malone — MVP Mailman
  "barklch01-PHI-1990s", // Charles Barkley — peak Sixers Chuck
  "robinda01-SAS-1990s", // David Robinson — MVP Admiral
  "bayloel01-LAL-1960s", // Elgin Baylor — 38/19 season
]);

/** Is this exact pool line a legend's peak form (the "jackpot" pull)? */
export function isLegendary(p: Pick<PlayerStatLine, "id">): boolean {
  return LEGEND_IDS.has(p.id);
}

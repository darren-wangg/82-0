/**
 * Legendary "jackpot" pulls — a curated top-15-of-all-time list, keyed by the
 * full stat-line id (player-franchise-decade) so only each legend's PEAK form
 * lights up: LAL-2000s Shaq is a jackpot, Cavs Shaq is just a guy. One line
 * per legend, picked by engine playerScore over snapshot-v1 and sanity-checked
 * against canon (e.g. Wilt's 50-a-game Warriors year).
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
]);

/** Is this exact pool line a legend's peak form (the "jackpot" pull)? */
export function isLegendary(p: Pick<PlayerStatLine, "id">): boolean {
  return LEGEND_IDS.has(p.id);
}

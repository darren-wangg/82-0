/**
 * Legendary "jackpot" pulls — a curated top-25-of-all-time list, keyed by
 * playerSlug so every stat line of these players counts. Curated rather than
 * engine-ranked: the engine's era-adjusted scores surface lines (60s big-men
 * stats, modern usage monsters) that don't read as "all-time top 25" when a
 * row lights up gold. Slugs verified against snapshot-v1.
 */

import type { PlayerStatLine } from "@/lib/contracts";

export const LEGEND_SLUGS: ReadonlySet<string> = new Set([
  "jordami01", // Michael Jordan
  "jamesle01", // LeBron James
  "abdulka01", // Kareem Abdul-Jabbar
  "johnsma02", // Magic Johnson
  "birdla01", // Larry Bird
  "chambwi01", // Wilt Chamberlain
  "russebi01", // Bill Russell
  "duncati01", // Tim Duncan
  "bryanko01", // Kobe Bryant
  "onealsh01", // Shaquille O'Neal
  "olajuha01", // Hakeem Olajuwon
  "curryst01", // Stephen Curry
  "duranke01", // Kevin Durant
  "antetgi01", // Giannis Antetokounmpo
  "jokicni01", // Nikola Jokić
  "nowitdi01", // Dirk Nowitzki
  "roberos01", // Oscar Robertson
  "westje01", // Jerry West
  "ervinju01", // Julius Erving
  "malonmo01", // Moses Malone
  "garneke01", // Kevin Garnett
  "malonka01", // Karl Malone
  "barklch01", // Charles Barkley
  "robinda01", // David Robinson
  "bayloel01", // Elgin Baylor
]);

/** Is this pool line one of the top-25-of-all-time "jackpot" pulls? */
export function isLegendary(p: Pick<PlayerStatLine, "playerSlug">): boolean {
  return LEGEND_SLUGS.has(p.playerSlug);
}

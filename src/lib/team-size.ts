/**
 * Shared team-size preference (5 / 8 / 10), persisted in a session cookie so it
 * carries across screens and is readable by the server-rendered social pages.
 * Default is 8 (the classic lineup). This module is client-safe — server pages
 * read the cookie via next/headers and pass the result through resolveTeamSize.
 */

export const TEAM_SIZES = [5, 8, 10] as const;
export type TeamSize = (typeof TEAM_SIZES)[number];

export const DEFAULT_TEAM_SIZE: TeamSize = 8;

/** Session cookie (no Max-Age → cleared when the browser session ends). */
export const TEAM_SIZE_COOKIE = "ud:team-size";

export function resolveTeamSize(raw: string | undefined | null): TeamSize {
  const n = Number(raw);
  return (TEAM_SIZES as readonly number[]).includes(n)
    ? (n as TeamSize)
    : DEFAULT_TEAM_SIZE;
}

/** Draft route for each size (home's Start Draft target). 8 = the main flow. */
export const PLAY_PATH: Record<TeamSize, string> = {
  5: "/play5",
  8: "/play",
  10: "/play10",
};

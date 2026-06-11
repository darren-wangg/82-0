/**
 * Teams saved to this device only (no server, no share link): a small
 * localStorage list, newest first. Storage failures (private mode, quota)
 * surface as a false return — callers show a toast instead of crashing.
 */

import type { Roster, SeasonResult, TeamRating } from "@/lib/contracts";

const LOCAL_TEAMS_KEY = "eighty-two-zero/my-teams/v1";
const MAX_LOCAL_TEAMS = 50;

export interface LocalTeam {
  id: string;
  name: string;
  roster: Roster;
  snapshotVersion: string;
  wins: number;
  losses: number;
  ovr: number;
  savedAt: string;
}

export function loadLocalTeams(): LocalTeam[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_TEAMS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as LocalTeam[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalTeam(team: {
  name: string;
  roster: Roster;
  snapshotVersion: string;
  rating: TeamRating;
  season: SeasonResult;
}): boolean {
  const entry: LocalTeam = {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    name: team.name,
    roster: team.roster,
    snapshotVersion: team.snapshotVersion,
    wins: team.season.wins,
    losses: team.season.losses,
    ovr: team.rating.ovr,
    savedAt: new Date().toISOString(),
  };
  try {
    const list = [entry, ...loadLocalTeams()].slice(0, MAX_LOCAL_TEAMS);
    window.localStorage.setItem(LOCAL_TEAMS_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export function removeLocalTeam(id: string): boolean {
  try {
    const list = loadLocalTeams().filter((t) => t.id !== id);
    window.localStorage.setItem(LOCAL_TEAMS_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

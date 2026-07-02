/**
 * Live-lobby shared types, phase logic, and request schemas.
 *
 * Kept off the frozen contracts.ts (like FlexibleRosterSchema and the budget
 * fields): these are additive, persistence/transport types for the live-draft
 * feature, importable by both client components and server routes (no server
 * imports here — pure types + zod).
 *
 * A live lobby moves through three phases, derived from timestamps so there's
 * no enum/state column to migrate:
 *   waiting   — players join the room; the creator hasn't started.
 *   drafting  — the creator started (startedAt set); everyone drafts at once.
 *   results   — all finished (or the creator ended it): closedAt set, standings
 *               + round-robin run exactly as in async lobbies.
 */

import { z } from "zod";

export type LobbyPhase = "waiting" | "drafting" | "results";

/** Derive the phase from the lobby's timestamps. closedAt wins (results),
 *  then startedAt (drafting), else waiting. */
export function lobbyPhase(lobby: {
  startedAt: Date | null;
  closedAt: Date | null;
}): LobbyPhase {
  if (lobby.closedAt) return "results";
  if (lobby.startedAt) return "drafting";
  return "waiting";
}

/** One participant's live presence + draft progress. */
export interface LiveParticipant {
  displayName: string;
  /** Picks placed so far (0 → rosterSize). */
  picksCount: number;
  done: boolean;
  teamSlug: string | null;
  /** True for the polling device's own row. */
  isViewer: boolean;
  isCreator: boolean;
}

/** Compact live state for the waiting room + draft tracker (polled ~2s). No
 *  round-robin here — standings run only at results, on the existing path. */
export interface LiveLobbyState {
  code: string;
  name: string;
  phase: LobbyPhase;
  /** Picks each player makes = the lobby's roster size (5 / 8 / 10). */
  rosterSize: number;
  /** Budget lobby: everyone drafts under the same salary cap. */
  isBudget: boolean;
  teamLimit: number | null;
  startedAt: string | null;
  participants: LiveParticipant[];
  /** The polling device's role/progress, for gating UI without scanning the list. */
  viewer: {
    joined: boolean;
    isCreator: boolean;
    done: boolean;
    teamSlug: string | null;
  };
}

/** POST /api/lobbies/[code]/join body. */
export const JoinLobbyBodySchema = z.object({
  displayName: z.string().trim().min(1).max(24),
});
export type JoinLobbyBody = z.infer<typeof JoinLobbyBodySchema>;

/** PATCH /api/lobbies/[code]/progress body. */
export const DraftProgressBodySchema = z.object({
  picksCount: z.number().int().min(0).max(10),
});
export type DraftProgressBody = z.infer<typeof DraftProgressBodySchema>;

/** POST /api/lobbies/[code]/finish body — same shape as an async lobby entry,
 *  minus the code (it's in the route param). */
export const FinishLobbyBodySchema = z.object({
  teamSlug: z.string(),
  displayName: z.string().trim().min(1).max(24).optional(),
});
export type FinishLobbyBody = z.infer<typeof FinishLobbyBodySchema>;

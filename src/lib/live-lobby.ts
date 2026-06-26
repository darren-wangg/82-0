/**
 * Feature-local types and Zod schemas for Live Lobbies.
 * All new live-lobby types live here — NOT in the frozen src/lib/contracts.ts.
 * Import existing shared types (TeamSize, etc.) from contracts.ts as needed.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Phase
// ---------------------------------------------------------------------------

/** The three phases of a live lobby lifecycle. */
export type LobbyPhase = "waiting" | "drafting" | "results";

// ---------------------------------------------------------------------------
// Participant state
// ---------------------------------------------------------------------------

/** Per-player progress row returned by GET …/live. */
export interface LiveParticipant {
  displayName: string;
  picksCount: number;
  total: number;
  done: boolean;
}

// ---------------------------------------------------------------------------
// LiveLobbyState — returned by GET /api/lobbies/[code]/live
// ---------------------------------------------------------------------------

export interface LiveLobbyState {
  phase: LobbyPhase;
  /** Always true for lobbies created with isLive=true. */
  isLive: boolean;
  participants: LiveParticipant[];
  /** ISO timestamp set when the creator hits Start; null in waiting phase. */
  startedAt: string | null;
  /** Roster size for the lobby (determines draft mode on the client). */
  teamSize: number;
}

// ---------------------------------------------------------------------------
// Request schemas for the five live routes
// ---------------------------------------------------------------------------

/** POST /api/lobbies/[code]/join */
export const JoinLobbySchema = z.object({
  displayName: z.string().min(1).max(24),
});
export type JoinLobbyRequest = z.infer<typeof JoinLobbySchema>;

/** POST /api/lobbies/[code]/start — body is empty; auth is cookie-based. */
export const StartLobbySchema = z.object({});
export type StartLobbyRequest = z.infer<typeof StartLobbySchema>;

/** PATCH /api/lobbies/[code]/progress */
export const DraftProgressSchema = z.object({
  picksCount: z.number().int().min(0).max(10),
});
export type DraftProgressRequest = z.infer<typeof DraftProgressSchema>;

/** POST /api/lobbies/[code]/finish */
export const FinishLobbySchema = z.object({
  teamSlug: z.string().min(1),
  displayName: z.string().min(1).max(24).optional(),
});
export type FinishLobbyRequest = z.infer<typeof FinishLobbySchema>;

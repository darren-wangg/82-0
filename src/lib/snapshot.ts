/**
 * SERVER access point for the player-data snapshot (the ETL output).
 * Consumers must not import snapshot JSON directly.
 *
 * The static import below compiles the full snapshot into whatever bundle
 * includes this module — that is fine on the server and in tests/scripts, but
 * client components must use src/lib/snapshot-client.ts (which fetches the
 * JSON from the CDN) instead.
 */

import { Snapshot, PlayerStatLine, Decade, EraBaselines } from "./contracts";
import { baselinesOf, parseSnapshot, playerMapOf, poolOf } from "./snapshot-core";
import rawSnapshot from "../../public/data/snapshot-v1.json";

let cached: Snapshot | null = null;

export function getSnapshot(): Snapshot {
  if (!cached) cached = parseSnapshot(rawSnapshot);
  return cached;
}

export function getPlayerMap(snapshot = getSnapshot()): Map<string, PlayerStatLine> {
  return playerMapOf(snapshot);
}

export function getPool(
  franchiseId: string,
  decade: Decade,
  snapshot = getSnapshot()
): PlayerStatLine[] {
  return poolOf(snapshot, franchiseId, decade);
}

export function getBaselines(snapshot = getSnapshot()): EraBaselines {
  return baselinesOf(snapshot);
}

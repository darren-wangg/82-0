/**
 * Single access point for the player-data snapshot (the ETL output).
 * Consumers must not import snapshot JSON directly.
 */

import { Snapshot, SnapshotSchema, PlayerStatLine, Decade } from "./contracts";
import rawSnapshot from "../../public/data/snapshot-v1.json";

let cached: Snapshot | null = null;

export function getSnapshot(): Snapshot {
  if (!cached) cached = SnapshotSchema.parse(rawSnapshot);
  return cached;
}

export function getPlayerMap(snapshot = getSnapshot()): Map<string, PlayerStatLine> {
  return new Map(snapshot.players.map((p) => [p.id, p]));
}

export function getPool(
  franchiseId: string,
  decade: Decade,
  snapshot = getSnapshot()
): PlayerStatLine[] {
  const ids = snapshot.pools[franchiseId]?.[decade] ?? [];
  const map = getPlayerMap(snapshot);
  return ids.flatMap((id) => map.get(id) ?? []);
}

export function getBaselines(snapshot = getSnapshot()) {
  return Object.fromEntries(snapshot.baselines.map((b) => [b.decade, b])) as Record<
    Decade,
    (typeof snapshot.baselines)[number]
  >;
}

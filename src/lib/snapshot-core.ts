/**
 * Snapshot parsing + derived lookups shared by the server accessor
 * (src/lib/snapshot.ts, static import) and the client accessor
 * (src/lib/snapshot-client.ts, fetched from /data). Keep this module free of
 * any JSON import — that is exactly what keeps the 1.6 MB snapshot out of the
 * client JS bundle.
 */

import {
  Decade,
  EraBaselines,
  PlayerStatLine,
  Snapshot,
  SnapshotSchema,
} from "./contracts";

/** Zod-validate in dev/test; in production the ETL already validated this
 *  exact file at build time, so skip the (full-dataset) parse cost. */
export function parseSnapshot(raw: unknown): Snapshot {
  return process.env.NODE_ENV === "production"
    ? (raw as Snapshot)
    : SnapshotSchema.parse(raw);
}

// Derived lookups are memoized per snapshot object: getPlayerMap() used to
// rebuild a ~2,000-entry Map on every call.
const playerMaps = new WeakMap<Snapshot, Map<string, PlayerStatLine>>();
const baselineMaps = new WeakMap<Snapshot, EraBaselines>();

export function playerMapOf(snapshot: Snapshot): Map<string, PlayerStatLine> {
  let map = playerMaps.get(snapshot);
  if (!map) {
    map = new Map(snapshot.players.map((p) => [p.id, p]));
    playerMaps.set(snapshot, map);
  }
  return map;
}

export function baselinesOf(snapshot: Snapshot): EraBaselines {
  let baselines = baselineMaps.get(snapshot);
  if (!baselines) {
    baselines = Object.fromEntries(
      snapshot.baselines.map((b) => [b.decade, b])
    ) as EraBaselines;
    baselineMaps.set(snapshot, baselines);
  }
  return baselines;
}

export function poolOf(
  snapshot: Snapshot,
  franchiseId: string,
  decade: Decade
): PlayerStatLine[] {
  const ids = snapshot.pools[franchiseId]?.[decade] ?? [];
  const map = playerMapOf(snapshot);
  return ids.flatMap((id) => map.get(id) ?? []);
}

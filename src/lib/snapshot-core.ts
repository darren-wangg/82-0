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
} from "./contracts";

/**
 * Cheap structural sanity check. The ETL zod-validates the snapshot when it is
 * generated and scripts/etl/validate.test.ts re-validates the shipped file
 * against SnapshotSchema on every test run, so runtime only guards against a
 * truncated/mismatched download — deliberately WITHOUT importing zod, which
 * would ship the whole schema runtime to every client bundle (and a full
 * zod parse of the 1.5 MB dataset cost real main-thread time on mobile).
 */
export function parseSnapshot(raw: unknown): Snapshot {
  const s = raw as Snapshot;
  if (
    typeof s?.version !== "string" ||
    !Array.isArray(s.players) ||
    !Array.isArray(s.franchises) ||
    !Array.isArray(s.baselines) ||
    typeof s.pools !== "object" ||
    s.pools === null
  ) {
    throw new Error("snapshot payload is malformed");
  }
  return s;
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

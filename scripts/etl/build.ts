/**
 * 82-0 Plus data pipeline.
 *
 * Builds public/data/snapshot-v1.json from the open, Basketball-Reference-
 * derived "NBA Stats (1947-present)" dataset by Sumitro Datta (CC BY-SA 4.0),
 * fetched from GitHub (see fetch.ts) — no scraping of basketball-reference.com.
 *
 * Run with: npm run etl
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SnapshotSchema } from "../../src/lib/contracts-schemas";
import {
  DECADES,
  POSITIONS,
  type Decade,
  type EraBaseline,
  type Franchise,
  type NineCatLine,
  type PlayerStatLine,
  type Position,
  type Snapshot,
} from "../../src/lib/contracts";
import { parseCsv, num, type CsvRow } from "./csv";
import { fetchDatasetCsv, fetchCached, NBA_API_PLAYERS_URL } from "./fetch";
import { FRANCHISE_NAMES, TEAM_TO_FRANCHISE } from "./franchises";
import {
  estimateBlk,
  estimateDrtg,
  estimateOrtg,
  estimateStl,
  estimateTov,
  inferPosition,
  trueShooting,
} from "./estimate";
import { buildNbaIdIndex, normalizeName } from "./nba-ids";
import { EXCLUDED_POOLS } from "./excluded-pools";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT_FILE = path.join(ROOT, "public", "data", "snapshot-v1.json");
const NICKNAMES_FILE = path.join(ROOT, "data", "nicknames.json");

const FIRST_SEASON = 1960; // 1959-60; decades 1960s..2020s only
const POOL_CAP = 25;
const ATTRIBUTION =
  'Player and team statistics derived from the "NBA Stats (1947-present)" dataset ' +
  "by Sumitro Datta (github.com/sumitrodatta/bball-reference-datasets, also on Kaggle), " +
  "licensed CC BY-SA 4.0 and itself compiled from Basketball-Reference.com data. " +
  "Headshot player-id mapping from the nba_api project (github.com/swar/nba_api, MIT). " +
  "Pre-1974 STL/BLK, pre-1978 TOV, pre-1980 NBA 3PM and early-era ORtg/DRtg are estimates " +
  "(see estimatedCats and scripts/etl/README.md).";

const round = (v: number, dp: number) => {
  const f = 10 ** dp;
  return Math.round(v * f) / f;
};

function decadeOf(season: number): Decade | null {
  const d = `${Math.floor(season / 10) * 10}s` as Decade;
  return (DECADES as readonly string[]).includes(d) ? d : null;
}

function seasonLabel(season: number): string {
  return `${season - 1}-${String(season % 100).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// League context from Team Summaries
// ---------------------------------------------------------------------------

interface LeagueContext {
  scheduleGames: number; // longest team schedule that season (pro-rates GP gate)
  ortg: number; // league points per 100 possessions
  ts: number; // league true shooting
}

function buildLeagueContext(teamRows: CsvRow[]): Map<string, LeagueContext> {
  const ctx = new Map<string, LeagueContext>();
  const teamsBySeason = new Map<string, CsvRow[]>();
  for (const r of teamRows) {
    const season = num(r.season);
    if (!season || season < FIRST_SEASON) continue;
    if (r.lg !== "NBA" && r.lg !== "ABA") continue;
    const key = `${season}|${r.lg}`;
    (teamsBySeason.get(key) ?? teamsBySeason.set(key, []).get(key)!).push(r);
  }
  for (const [key, rows] of teamsBySeason) {
    const teams = rows.filter((r) => r.team !== "League Average");
    const lgAvg = rows.find((r) => r.team === "League Average");
    const scheduleGames = Math.max(...teams.map((r) => (num(r.w) ?? 0) + (num(r.l) ?? 0)));
    const meanOf = (col: string) => {
      const vals = teams.map((r) => num(r[col])).filter((v): v is number => v !== undefined);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : undefined;
    };
    const ortg = num(lgAvg?.o_rtg) ?? meanOf("o_rtg");
    const ts = num(lgAvg?.ts_percent) ?? meanOf("ts_percent");
    if (!scheduleGames || ortg === undefined || ts === undefined) {
      throw new Error(`league context incomplete for ${key}`);
    }
    ctx.set(key, { scheduleGames, ortg, ts });
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Candidate stat lines (player x franchise x season)
// ---------------------------------------------------------------------------

interface Candidate {
  slug: string;
  name: string;
  franchiseId: string;
  decade: Decade;
  season: number;
  position: Position;
  stats: NineCatLine;
  ortg: number;
  drtg: number;
  estimatedCats: string[];
  composite: number;
}

interface LeagueShooting {
  fgPct: number;
  ftPct: number;
}

function buildLeagueShooting(rows: CsvRow[]): Map<string, LeagueShooting> {
  // games-weighted league FG%/FT% per season+lg, for the volume-aware composite
  const acc = new Map<string, { fgm: number; fga: number; ftm: number; fta: number }>();
  for (const r of rows) {
    const season = num(r.season);
    if (!season || season < FIRST_SEASON) continue;
    if (r.lg !== "NBA" && r.lg !== "ABA") continue;
    const g = num(r.g) ?? 0;
    if (g <= 0 || r.team.endsWith("TM")) continue;
    const key = `${season}|${r.lg}`;
    const a = acc.get(key) ?? { fgm: 0, fga: 0, ftm: 0, fta: 0 };
    a.fgm += (num(r.fg_per_game) ?? 0) * g;
    a.fga += (num(r.fga_per_game) ?? 0) * g;
    a.ftm += (num(r.ft_per_game) ?? 0) * g;
    a.fta += (num(r.fta_per_game) ?? 0) * g;
    acc.set(key, a);
  }
  const out = new Map<string, LeagueShooting>();
  for (const [key, a] of acc) {
    out.set(key, { fgPct: a.fga ? a.fgm / a.fga : 0.45, ftPct: a.fta ? a.ftm / a.fta : 0.75 });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Career positions — the dataset lists ONE position per season, which makes
// drafted rosters too rigid. Two extra signals widen altPositions:
//  1. every position a player was EVER listed at across his career (any
//     season, qualifying or not), and
//  2. play-by-play minute shares (1996-97+): a position is "played" when it
//     covers >= PBP_SHARE_MIN of tracked career minutes and >= PBP_MIN_MINUTES.
// ---------------------------------------------------------------------------

const PBP_SHARE_MIN = 0.15;
const PBP_MIN_MINUTES = 200;
const PBP_POS_COLS: ReadonlyArray<[string, Position]> = [
  ["pg_percent", "PG"],
  ["sg_percent", "SG"],
  ["sf_percent", "SF"],
  ["pf_percent", "PF"],
  ["c_percent", "C"],
];

function buildCareerPositions(
  perGame: CsvRow[],
  playByPlay: CsvRow[]
): Map<string, Set<Position>> {
  const career = new Map<string, Set<Position>>();
  const add = (slug: string, pos: Position) =>
    (career.get(slug) ?? career.set(slug, new Set()).get(slug)!).add(pos);

  for (const r of perGame) {
    const season = num(r.season);
    if (!season || season < FIRST_SEASON) continue;
    if (r.lg !== "NBA" && r.lg !== "ABA") continue;
    if (r.pos && (POSITIONS as readonly string[]).includes(r.pos)) {
      add(r.player_id, r.pos as Position);
    }
  }

  const minutesAt = new Map<string, Record<Position, number>>();
  for (const r of playByPlay) {
    if (r.lg !== "NBA" || r.team.endsWith("TM")) continue;
    const mp = num(r.mp);
    if (!mp) continue;
    const acc =
      minutesAt.get(r.player_id) ??
      minutesAt.set(r.player_id, { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 }).get(r.player_id)!;
    for (const [col, pos] of PBP_POS_COLS) {
      acc[pos] += (mp * (num(r[col]) ?? 0)) / 100;
    }
  }
  for (const [slug, acc] of minutesAt) {
    const total = POSITIONS.reduce((s, p) => s + acc[p], 0);
    if (total <= 0) continue;
    for (const pos of POSITIONS) {
      if (acc[pos] / total >= PBP_SHARE_MIN && acc[pos] >= PBP_MIN_MINUTES) {
        add(slug, pos);
      }
    }
  }
  return career;
}

/**
 * Composite 9-cat per-game production score, used both to pick a player's
 * peak season and to rank the franchise x decade pool:
 *   pts + 1.2 reb + 1.5 ast + 2 stl + 2 blk + 1.5 tpm - tov
 *   + 2.5 (fgPct - lgFgPct) x fga + 2 (ftPct - lgFtPct) x fta
 */
function compositeScore(s: NineCatLine, fga: number, fta: number, lg: LeagueShooting): number {
  return (
    s.pts +
    1.2 * s.reb +
    1.5 * s.ast +
    2 * s.stl +
    2 * s.blk +
    1.5 * s.tpm -
    s.tov +
    2.5 * (s.fgPct - lg.fgPct) * fga +
    2 * (s.ftPct - lg.ftPct) * fta
  );
}

async function main() {
  console.log("82-0 ETL: building snapshot-v1");

  // 1. Source data (cached under scripts/etl/.cache)
  const perGame = parseCsv(await fetchDatasetCsv("Player Per Game"));
  const per100 = parseCsv(await fetchDatasetCsv("Per 100 Poss"));
  const teamSummaries = parseCsv(await fetchDatasetCsv("Team Summaries"));
  const playByPlay = parseCsv(await fetchDatasetCsv("Player Play By Play"));
  const nbaApiSource = await fetchCached(NBA_API_PLAYERS_URL, "nba_api_players.py");

  const league = buildLeagueContext(teamSummaries);
  const leagueShooting = buildLeagueShooting(perGame);
  const careerPositions = buildCareerPositions(perGame, playByPlay);
  const nbaIds = buildNbaIdIndex(nbaApiSource);
  const nicknames: Record<string, string> = JSON.parse(readFileSync(NICKNAMES_FILE, "utf8"));

  // 2. Individual ratings join: season|playerId|team -> { ortg?, drtg? }
  const ratings = new Map<string, { ortg?: number; drtg?: number }>();
  for (const r of per100) {
    const season = num(r.season);
    if (!season || season < FIRST_SEASON) continue;
    ratings.set(`${season}|${r.player_id}|${r.team}`, {
      ortg: num(r.o_rtg),
      drtg: num(r.d_rtg),
    });
  }

  // 3. Candidate stat lines from qualifying player-seasons
  const candidates: Candidate[] = [];
  const namesBySlug = new Map<string, string>();
  const posBySlugDecade = new Map<string, Set<Position>>();
  let skippedUnmappedTeams = 0;

  for (const r of perGame) {
    const season = num(r.season);
    if (!season || season < FIRST_SEASON) continue;
    if (r.lg !== "NBA" && r.lg !== "ABA") continue;
    if (r.team.endsWith("TM")) continue; // multi-team aggregate rows
    const decade = decadeOf(season);
    if (!decade) continue;

    const franchiseId = TEAM_TO_FRANCHISE[r.team];
    if (!franchiseId) {
      skippedUnmappedTeams++; // defunct ABA teams, intentionally excluded
      continue;
    }

    const lgKey = `${season}|${r.lg}`;
    const ctx = league.get(lgKey);
    const shooting = leagueShooting.get(lgKey);
    if (!ctx || !shooting) continue;

    // GP gate: half the season's longest schedule (41 for 82 games; pro-rates
    // 1960s 75-80 game schedules and lockout/COVID seasons automatically).
    const g = num(r.g) ?? 0;
    const mp = num(r.mp_per_game) ?? 0;
    if (g < Math.round(ctx.scheduleGames / 2) || mp <= 0) continue;

    const slug = r.player_id;
    namesBySlug.set(slug, r.player);

    const position =
      r.pos && (POSITIONS as readonly string[]).includes(r.pos)
        ? (r.pos as Position)
        : inferPosition(num(r.ast_per_game) ?? 0, num(r.trb_per_game) ?? 0);
    const posKey = `${slug}|${decade}`;
    (posBySlugDecade.get(posKey) ?? posBySlugDecade.set(posKey, new Set()).get(posKey)!).add(
      position
    );

    const estimatedCats: string[] = [];
    const pts = num(r.pts_per_game) ?? 0;
    const reb = num(r.trb_per_game) ?? 0;
    const ast = num(r.ast_per_game) ?? 0;
    const fga = num(r.fga_per_game) ?? 0;
    const fta = num(r.fta_per_game) ?? 0;
    const fgPct = num(r.fg_percent) ?? shooting.fgPct;
    const ftPct = num(r.ft_percent) ?? shooting.ftPct;

    let stl = num(r.stl_per_game);
    if (stl === undefined) {
      stl = estimateStl(position, mp);
      estimatedCats.push("stl");
    }
    let blk = num(r.blk_per_game);
    if (blk === undefined) {
      blk = estimateBlk(position, mp, reb);
      estimatedCats.push("blk");
    }
    let tov = num(r.tov_per_game);
    if (tov === undefined) {
      tov = estimateTov(fga, fta, ast);
      estimatedCats.push("tov");
    }

    let tpm: number;
    if (r.lg === "NBA" && season < 1980) {
      tpm = 0; // no 3-point line in the NBA before 1979-80
      estimatedCats.push("tpm");
    } else {
      tpm = num(r.x3p_per_game) ?? 0;
    }

    const rating = ratings.get(`${season}|${slug}|${r.team}`);
    let ortg = rating?.ortg;
    if (ortg === undefined) {
      ortg = estimateOrtg(ctx.ortg, ctx.ts, trueShooting(pts, fga, fta), ast);
      estimatedCats.push("ortg");
    }
    let drtg = rating?.drtg;
    if (drtg === undefined) {
      drtg = estimateDrtg(ctx.ortg, reb, stl, blk);
      estimatedCats.push("drtg");
    }

    const stats: NineCatLine = {
      pts,
      reb,
      ast,
      stl: round(stl, 2),
      blk: round(blk, 2),
      fgPct: round(fgPct, 3),
      ftPct: round(ftPct, 3),
      tpm: round(tpm, 2),
      tov: round(tov, 2),
    };

    candidates.push({
      slug,
      name: r.player,
      franchiseId,
      decade,
      season,
      position,
      stats,
      ortg: round(ortg, 1),
      drtg: round(drtg, 1),
      estimatedCats,
      composite: compositeScore(stats, fga, fta, shooting),
    });
  }

  // 4. Peak season per player x franchise x decade
  const peaks = new Map<string, Candidate>();
  for (const c of candidates) {
    const key = `${c.slug}-${c.franchiseId}-${c.decade}`;
    const cur = peaks.get(key);
    if (
      !cur ||
      c.composite > cur.composite ||
      (c.composite === cur.composite && c.season > cur.season)
    ) {
      peaks.set(key, c);
    }
  }

  // 5. Franchise x decade pools, top POOL_CAP by composite
  const byPool = new Map<string, Candidate[]>();
  for (const c of peaks.values()) {
    const key = `${c.franchiseId}|${c.decade}`;
    (byPool.get(key) ?? byPool.set(key, []).get(key)!).push(c);
  }

  const decadeIdx = (d: Decade) => DECADES.indexOf(d);
  const players: PlayerStatLine[] = [];
  const pools: Record<string, Record<string, string[]>> = {};
  // nba_api ids only for names unique among our slugs too
  const slugsByName = new Map<string, Set<string>>();
  for (const [slug, name] of namesBySlug) {
    const key = normalizeName(name);
    (slugsByName.get(key) ?? slugsByName.set(key, new Set()).get(key)!).add(slug);
  }

  const sortedPoolKeys = [...byPool.keys()].sort((a, b) => {
    const [fa, da] = a.split("|");
    const [fb, db] = b.split("|");
    return fa === fb ? decadeIdx(da as Decade) - decadeIdx(db as Decade) : fa < fb ? -1 : 1;
  });

  for (const key of sortedPoolKeys) {
    const [franchiseId, decade] = key.split("|") as [string, Decade];
    const pool = byPool
      .get(key)!
      .sort((a, b) => b.composite - a.composite)
      .slice(0, POOL_CAP);
    pools[franchiseId] ??= {};
    pools[franchiseId][decade] = [];
    for (const c of pool) {
      const id = `${c.slug}-${c.franchiseId}-${c.decade}`;
      const nameKey = normalizeName(c.name);
      const nbaId =
        slugsByName.get(nameKey)?.size === 1 ? nbaIds.get(nameKey) : undefined;
      const alt = [
        ...new Set([
          ...(posBySlugDecade.get(`${c.slug}|${c.decade}`) ?? []),
          ...(careerPositions.get(c.slug) ?? []),
        ]),
      ]
        .filter((p) => p !== c.position)
        .sort((a, b) => POSITIONS.indexOf(a) - POSITIONS.indexOf(b));
      players.push({
        id,
        playerSlug: c.slug,
        name: c.name,
        ...(nicknames[c.slug] ? { nickname: nicknames[c.slug] } : {}),
        ...(nbaId !== undefined ? { nbaPlayerId: nbaId } : {}),
        franchiseId: c.franchiseId,
        decade: c.decade,
        peakSeason: seasonLabel(c.season),
        position: c.position,
        altPositions: alt,
        stats: c.stats,
        ortg: c.ortg,
        drtg: c.drtg,
        estimatedCats: c.estimatedCats,
      });
      pools[franchiseId][decade].push(id);
    }
  }

  // 6. Franchises with derived activeDecades
  const franchises: Franchise[] = Object.keys(FRANCHISE_NAMES)
    .sort()
    .map((fid) => ({
      id: fid,
      name: FRANCHISE_NAMES[fid],
      activeDecades: DECADES.filter((d) => (pools[fid]?.[d]?.length ?? 0) > 0),
    }));

  // 7. Era baselines: mean + sd of each cat + ratings across pool members
  const SD_FLOOR: Record<string, number> = { fgPct: 0.005, ftPct: 0.01, tpm: 0.05, ortg: 0.5, drtg: 0.5 };
  const CATS = ["pts", "reb", "ast", "stl", "blk", "fgPct", "ftPct", "tpm", "tov", "ortg", "drtg"] as const;
  const baselines: EraBaseline[] = DECADES.map((decade) => {
    const members = players.filter((p) => p.decade === decade);
    if (members.length === 0) throw new Error(`no pool members in ${decade}`);
    const mean = {} as Record<(typeof CATS)[number], number>;
    const sd = {} as Record<(typeof CATS)[number], number>;
    for (const cat of CATS) {
      const vals = members.map((p) =>
        cat === "ortg" || cat === "drtg" ? p[cat] : p.stats[cat]
      );
      const m = vals.reduce((a, b) => a + b, 0) / vals.length;
      const variance = vals.reduce((a, b) => a + (b - m) ** 2, 0) / vals.length;
      const dp = cat === "fgPct" || cat === "ftPct" ? 4 : 2;
      mean[cat] = round(m, dp);
      sd[cat] = round(Math.max(Math.sqrt(variance), SD_FLOOR[cat] ?? 0.05), dp);
    }
    return { decade, mean, sd };
  });

  // 7b. Drop the weakest franchise×decade combos so the slot machine can't
  //     land on them (see excluded-pools.ts). Done AFTER baselines so the era
  //     means/SDs — and therefore every other player's rating — are unchanged.
  let prunedPlayers = 0;
  for (const key of EXCLUDED_POOLS) {
    const [fid, decade] = key.split("|") as [string, Decade];
    const removed = pools[fid]?.[decade]?.length ?? 0;
    if (pools[fid]) {
      delete pools[fid][decade];
      if (Object.keys(pools[fid]).length === 0) delete pools[fid];
    }
    prunedPlayers += removed;
  }
  for (let i = players.length - 1; i >= 0; i--) {
    if (EXCLUDED_POOLS.has(`${players[i].franchiseId}|${players[i].decade}`)) {
      players.splice(i, 1);
    }
  }
  // activeDecades was derived from the pre-prune pools — recompute it.
  for (const f of franchises) {
    f.activeDecades = DECADES.filter((d) => (pools[f.id]?.[d]?.length ?? 0) > 0);
  }
  console.log(
    `  excluded ${EXCLUDED_POOLS.size} pools (${prunedPlayers} player lines) from drafting`
  );

  const snapshot: Snapshot = {
    version: "v1",
    generatedAt: new Date().toISOString(),
    attribution: ATTRIBUTION,
    franchises,
    baselines,
    players,
    pools,
  };

  SnapshotSchema.parse(snapshot);
  mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(snapshot));

  // 8. Report
  const byDecade = new Map<Decade, number>();
  for (const p of players) byDecade.set(p.decade, (byDecade.get(p.decade) ?? 0) + 1);
  console.log(`\n  players: ${players.length} (unique: ${new Set(players.map((p) => p.playerSlug)).size})`);
  for (const d of DECADES) console.log(`    ${d}: ${byDecade.get(d) ?? 0}`);
  const poolCounts = sortedPoolKeys.map((k) => byPool.get(k)!.length);
  console.log(
    `  pools: ${sortedPoolKeys.length} franchise-decades, sizes capped at ${POOL_CAP} ` +
      `(pre-cap min ${Math.min(...poolCounts)}, max ${Math.max(...poolCounts)})`
  );
  const modern = players.filter((p) => decadeIdx(p.decade) >= decadeIdx("1990s"));
  const withId = modern.filter((p) => p.nbaPlayerId !== undefined).length;
  console.log(
    `  headshots: ${withId}/${modern.length} (${((100 * withId) / modern.length).toFixed(1)}%) for 1990s+; ` +
      `${players.filter((p) => p.nbaPlayerId !== undefined).length}/${players.length} overall`
  );
  const multiPos = players.filter((p) => p.altPositions.length > 0).length;
  console.log(
    `  positions: ${multiPos}/${players.length} lines (${((100 * multiPos) / players.length).toFixed(1)}%) ` +
      "list at least one alt position (career listings + play-by-play minute shares)"
  );
  const withNick = new Set(players.filter((p) => p.nickname).map((p) => p.playerSlug)).size;
  console.log(`  nicknames: ${withNick} players matched from data/nicknames.json`);
  console.log(`  skipped rows on defunct (unmapped) ABA teams: ${skippedUnmappedTeams}`);
  console.log(`\n  wrote ${OUT_FILE} (${(JSON.stringify(snapshot).length / 1024).toFixed(0)} KB)`);

  if (existsSync(NICKNAMES_FILE)) {
    const unmatched = Object.keys(nicknames).filter((slug) => !namesBySlug.has(slug));
    if (unmatched.length > 0) {
      console.warn(`  WARNING: ${unmatched.length} nickname slugs not in dataset: ${unmatched.join(", ")}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

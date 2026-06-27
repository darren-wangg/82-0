/**
 * Simple side-by-side roster breakdown for a matchup: each team's 8 players
 * (starters then bench) as a headshot + name + position. Intentionally minimal.
 */

import type { PlayerStatLine } from "@/lib/contracts";
import { PlayerHeadshot } from "@/components/game/player-headshot";

function RosterColumn({
  teamName,
  players,
  align,
}: {
  teamName: string;
  players: PlayerStatLine[];
  align: "left" | "right";
}) {
  return (
    <div className="min-w-0 flex-1">
      <p
        className={cnAlign(align, "mb-2 truncate text-xs font-bold text-muted-foreground")}
      >
        {teamName}
      </p>
      <ul className="space-y-1.5">
        {players.map((p) => (
          <li
            key={p.id}
            className={
              align === "right"
                ? "flex flex-row-reverse items-center gap-2 text-right"
                : "flex items-center gap-2"
            }
          >
            <PlayerHeadshot player={p} className="size-7" />
            <span className="min-w-0 flex-1 truncate text-xs font-medium">
              {p.name}
            </span>
            <span className="shrink-0 font-mono text-[9px] text-muted-foreground">
              {p.position}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function cnAlign(align: "left" | "right", base: string): string {
  return align === "right" ? `${base} text-right` : base;
}

export function MatchupRosters({
  teamAName,
  teamAPlayers,
  teamBName,
  teamBPlayers,
}: {
  teamAName: string;
  teamAPlayers: PlayerStatLine[];
  teamBName: string;
  teamBPlayers: PlayerStatLine[];
}) {
  return (
    <div className="flex gap-3">
      <RosterColumn teamName={teamAName} players={teamAPlayers} align="left" />
      <div className="w-px shrink-0 bg-border" />
      <RosterColumn teamName={teamBName} players={teamBPlayers} align="right" />
    </div>
  );
}

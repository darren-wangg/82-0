/**
 * Renders a saved roster as a mobile-first grid of player cards (5 starters,
 * 3 bench); estimated-era stat lines get an "est." badge. Isomorphic: the
 * player map and headshot-source chain come in as props, so server pages
 * pass the snapshot module's versions and client views (e.g. the local team
 * page) pass the client loaders'.
 */

import { PlayerStatLine, POSITIONS, Roster } from "@/lib/contracts";
import { Badge } from "@/components/ui/badge";
import { PlayerHeadshot } from "./player-headshot";

type HeadshotSrcs = (
  p: Pick<PlayerStatLine, "nbaPlayerId" | "playerSlug">
) => string[];

function PlayerCard({
  player,
  slot,
  id,
  headshotSrcs,
}: {
  player: PlayerStatLine | undefined;
  slot: string;
  id: string;
  headshotSrcs: HeadshotSrcs;
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
      <PlayerHeadshot
        srcs={player ? headshotSrcs(player) : []}
        alt={player?.name ?? "Unknown player"}
        className="aspect-[13/10] w-full"
      />
      <div className="flex flex-1 flex-col gap-1 p-2">
        <div className="flex items-center justify-between gap-1">
          <span className="text-[10px] font-bold tracking-widest text-primary uppercase">
            {slot}
          </span>
          {player && player.estimatedCats.length > 0 && (
            <Badge variant="outline" className="h-4 px-1 text-[9px]" title="Some stats are estimates">
              est.
            </Badge>
          )}
        </div>
        <p className="truncate text-xs font-semibold leading-tight">
          {player?.name ?? id}
        </p>
        {player && (
          <p className="text-[10px] text-muted-foreground">
            {player.decade} · {player.franchiseId}
          </p>
        )}
      </div>
    </div>
  );
}

export function RosterGrid({
  roster,
  players,
  headshotSrcs,
}: {
  roster: Roster;
  players: Map<string, PlayerStatLine>;
  headshotSrcs: HeadshotSrcs;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {POSITIONS.map((pos) => {
          const id = roster.starters[pos] ?? "";
          return (
            <PlayerCard
              key={pos}
              slot={pos}
              id={id}
              player={players.get(id)}
              headshotSrcs={headshotSrcs}
            />
          );
        })}
        {roster.bench.map((id, i) => (
          <PlayerCard
            key={id}
            slot={`Bench ${i + 1}`}
            id={id}
            player={players.get(id)}
            headshotSrcs={headshotSrcs}
          />
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">
        est. = pre-modern era stats are partly estimated.
      </p>
    </div>
  );
}

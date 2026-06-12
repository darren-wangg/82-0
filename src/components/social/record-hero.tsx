/** Big projected-record hero with OVR / OFF / DEF chips and the gate note. */

import { SeasonResult, TeamRating } from "@/lib/contracts";
import { CAT_LABELS } from "./prompts";

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-1 flex-col items-center rounded-xl border border-border bg-card px-2 py-2">
      <span className="text-lg font-bold tabular-nums">{Math.round(value)}</span>
      <span className="font-arcade text-[8px] text-muted-foreground uppercase">
        {label}
      </span>
    </div>
  );
}

export function RecordHero({
  season,
  rating,
}: {
  season: SeasonResult;
  rating: TeamRating;
}) {
  return (
    <div className="space-y-3">
      <div className="text-center">
        <p className="text-6xl font-black tracking-tight tabular-nums">
          {season.wins}
          <span className="text-muted-foreground">–</span>
          {season.losses}
        </p>
        <p className="mt-1.5 font-arcade text-[9px] text-muted-foreground uppercase">
          Projected record
        </p>
        {season.gatedCategory && (
          <p className="mt-1 text-xs text-amber-500">
            Capped at {season.winCap} wins by {CAT_LABELS[season.gatedCategory]}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <StatChip label="OVR" value={rating.ovr} />
        <StatChip label="OFF" value={rating.offRating} />
        <StatChip label="DEF" value={rating.defRating} />
      </div>
    </div>
  );
}

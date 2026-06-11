"use client";

/**
 * Tap-friendly info popover explaining how the 9-cat profile is computed.
 * Lives next to the "9-cat profile" / "Category profile" card titles.
 */

import { Popover } from "@base-ui/react/popover";
import { Info } from "lucide-react";

export function CatProfileInfo() {
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label="How the 9-cat profile works"
        className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground data-[popup-open]:text-foreground"
      >
        <Info className="size-3.5" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={6} className="z-50 max-w-[calc(100vw-2rem)]">
          <Popover.Popup className="dark w-72 rounded-xl border border-border bg-popover p-3.5 text-xs leading-relaxed text-popover-foreground shadow-xl shadow-black/40 outline-none">
            <p className="font-semibold">How the 9-cat profile works</p>
            <p className="mt-1.5 text-muted-foreground">
              Every player&apos;s stats are first era-adjusted — normalized
              against their own decade, so a 1960s rebound isn&apos;t worth a
              2020s rebound. Each bar then shows your team&apos;s edge in that
              category versus the average drafted roster: 0 is average, and
              the bars max out at ±3. Starters count more than bench.
            </p>
            <p className="mt-1.5 text-muted-foreground">
              TO is flipped — positive means fewer turnovers. And one deep-red
              category can gate your season, capping your wins no matter how
              strong everything else is.
            </p>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

import { type Decade } from "@/lib/contracts";
import { cn } from "@/lib/utils";
import { DECADE_COLORS } from "./format";

/** Name suffixes that shouldn't supply the "last name" initial. */
const SUFFIX = /^(jr\.?|sr\.?|ii|iii|iv|v)$/i;

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter((p) => !SUFFIX.test(p));
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

/**
 * Retro trading-card placeholder for players with no usable headshot.
 * Decade-tinted gradient + inner ring, big display-font initials, and a small
 * decade label that only appears once the container is wide enough to keep it
 * legible (container query). Inherits the parent's border radius, so it works
 * clipped to circles (rosters/pool rows) and to card rectangles alike.
 */
export function RetroCardPlaceholder({
  name,
  decade,
  className,
}: {
  name: string;
  decade: Decade;
  className?: string;
}) {
  const colors = DECADE_COLORS[decade];

  return (
    <span
      aria-hidden
      className={cn(
        "@container relative flex items-center justify-center overflow-hidden rounded-[inherit]",
        colors.chip,
        className
      )}
    >
      {/* warm, aged-cardstock sheen over the decade tint */}
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-100/15 via-transparent to-black/35" />
      {/* vintage inner ring in the decade color */}
      <span
        className={cn(
          "pointer-events-none absolute inset-[3px] rounded-[inherit] ring-1",
          colors.ring
        )}
      />
      {/* SVG so the type scales with the container, from 36px chips to cards */}
      <svg viewBox="0 0 100 100" className="relative size-full">
        <text
          x="50"
          y="50"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="40"
          letterSpacing="2"
          className={cn("font-display fill-current", colors.text)}
        >
          {initialsOf(name)}
        </text>
        <text
          x="50"
          y="80"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="12"
          letterSpacing="3"
          className="hidden fill-current opacity-70 @min-[56px]:block"
        >
          {`'${decade.slice(2, 4)}s`}
        </text>
      </svg>
    </span>
  );
}

"use client";

import { useState } from "react";
import { teamLogoUrl } from "@/lib/team-logo";
import { cn } from "@/lib/utils";

/**
 * Franchise logo (unofficial CDN). Falls back to the tricode in a muted disc
 * when the id is unknown or the image fails — we never assume it loads.
 */
export function TeamLogo({
  franchiseId,
  className,
}: {
  franchiseId: string | null;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = franchiseId ? teamLogoUrl(franchiseId) : null;

  if (!src || failed) {
    return (
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full bg-muted text-[8px] font-bold tracking-tight text-muted-foreground",
          className
        )}
      >
        {franchiseId ?? ""}
      </span>
    );
  }

  return (
    <span
      className={cn("flex shrink-0 items-center justify-center", className)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- unofficial team-logo CDN, not run through the image optimizer */}
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        onError={() => setFailed(true)}
        className="size-full object-contain"
      />
    </span>
  );
}

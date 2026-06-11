"use client";

import { useState } from "react";
import Image from "next/image";
import { type PlayerStatLine } from "@/lib/contracts";
import { headshotSources } from "@/lib/headshots";
import { cn } from "@/lib/utils";
import { RetroCardPlaceholder } from "./retro-card";

/**
 * Player headshot served through the Next image optimizer (see next.config).
 * Sources are tried in order (NBA CDN, then the Wikipedia fallback resolved
 * at ETL time); when every source fails — or none exists — a retro
 * trading-card placeholder renders instead.
 */
export function PlayerHeadshot({
  player,
  className,
}: {
  player: Pick<PlayerStatLine, "nbaPlayerId" | "playerSlug" | "name" | "decade">;
  className?: string;
}) {
  const [failed, setFailed] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const src = headshotSources(player).find((s) => !failed.includes(s));

  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted",
        className
      )}
    >
      {src ? (
        <Image
          src={src}
          alt=""
          fill
          sizes="56px"
          className={cn(
            "object-cover transition-opacity duration-300",
            loaded ? "opacity-100" : "opacity-0"
          )}
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed((f) => [...f, src])}
        />
      ) : (
        <RetroCardPlaceholder
          name={player.name}
          decade={player.decade}
          className="absolute inset-0"
        />
      )}
    </span>
  );
}

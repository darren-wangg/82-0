"use client";

import { useState } from "react";
import Image from "next/image";
import { UserRound } from "lucide-react";
import { type PlayerStatLine } from "@/lib/contracts";
import { headshotSources } from "@/lib/headshots-client";
import { isLocalHeadshot } from "@/lib/headshots-core";
import { cn } from "@/lib/utils";

/**
 * Player headshot. Baked static assets (served by us, immutable, no image
 * optimizer) render as a plain <img>; the remote fallback chain — NBA CDN, then
 * the ETL-resolved hosts — goes through the Next image optimizer. Sources are
 * tried in order; when every source fails — or none exists — a silhouette
 * renders instead.
 */
export function PlayerHeadshot({
  player,
  className,
}: {
  player: Pick<PlayerStatLine, "nbaPlayerId" | "playerSlug" | "name">;
  className?: string;
}) {
  const [failed, setFailed] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const src = headshotSources(player).find((s) => !failed.includes(s));

  const onError = () => setFailed((f) => [...f, src!]);
  const imgClass = cn(
    "object-cover transition-opacity duration-300",
    loaded ? "opacity-100" : "opacity-0"
  );

  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted",
        className
      )}
    >
      {!src ? (
        <UserRound aria-hidden className="size-[55%] text-muted-foreground" />
      ) : isLocalHeadshot(src) ? (
        // eslint-disable-next-line @next/next/no-img-element -- baked static asset, intentionally not optimized
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={onError}
          className={cn("absolute inset-0 size-full", imgClass)}
        />
      ) : (
        <Image
          src={src}
          alt=""
          fill
          sizes="56px"
          className={imgClass}
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={onError}
        />
      )}
    </span>
  );
}

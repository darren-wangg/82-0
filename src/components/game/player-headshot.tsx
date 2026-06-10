"use client";

import { useState } from "react";
import Image from "next/image";
import { UserRound } from "lucide-react";
import { headshotUrl, type PlayerStatLine } from "@/lib/contracts";
import { cn } from "@/lib/utils";

/**
 * Player headshot served through the Next image optimizer (see next.config),
 * with a silhouette fallback when there is no nbaPlayerId or the source
 * image fails to load.
 */
export function PlayerHeadshot({
  player,
  className,
}: {
  player: Pick<PlayerStatLine, "nbaPlayerId" | "name">;
  className?: string;
}) {
  const url = headshotUrl(player);
  const [failed, setFailed] = useState(false);

  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted",
        className
      )}
    >
      {url && !failed ? (
        <Image
          src={url}
          alt=""
          fill
          sizes="56px"
          className="object-cover"
          draggable={false}
          onError={() => setFailed(true)}
        />
      ) : (
        <UserRound aria-hidden className="size-[55%] text-muted-foreground" />
      )}
    </span>
  );
}

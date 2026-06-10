"use client";

import { UserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { headshotUrl, type PlayerStatLine } from "@/lib/contracts";
import { cn } from "@/lib/utils";

/**
 * Player headshot via the (unofficial) NBA CDN with a silhouette fallback —
 * shown when there is no nbaPlayerId or the image fails to load.
 */
export function PlayerHeadshot({
  player,
  className,
}: {
  player: Pick<PlayerStatLine, "nbaPlayerId" | "name">;
  className?: string;
}) {
  const url = headshotUrl(player);
  return (
    <Avatar className={cn("bg-muted", className)}>
      {url && (
        <AvatarImage src={url} alt="" loading="lazy" draggable={false} />
      )}
      <AvatarFallback aria-hidden>
        <UserRound className="size-[55%] text-muted-foreground" />
      </AvatarFallback>
    </Avatar>
  );
}

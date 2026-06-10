"use client";

/**
 * Player headshot with silhouette fallback. The NBA CDN is unofficial, so the
 * image is never assumed to load — any error swaps in the silhouette.
 */

import { useState } from "react";
import { cn } from "@/lib/utils";

function Silhouette({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "flex items-end justify-center overflow-hidden bg-muted",
        className
      )}
    >
      <svg viewBox="0 0 24 24" className="size-3/4 fill-muted-foreground/40">
        <path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2.25c-4.97 0-9 2.69-9 6V24h18v-3.75c0-3.31-4.03-6-9-6Z" />
      </svg>
    </div>
  );
}

export function PlayerHeadshot({
  src,
  alt,
  className,
}: {
  src: string | null;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) return <Silhouette className={className} />;

  return (
    // Remote CDN with runtime fallback; next/image remotePatterns config lives
    // in the shared next.config.ts, which this wave doesn't own.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn("bg-muted object-cover object-top", className)}
    />
  );
}

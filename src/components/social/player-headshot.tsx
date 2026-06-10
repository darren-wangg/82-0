"use client";

/**
 * Player headshot with silhouette fallback. The NBA CDN is unofficial, so the
 * image is never assumed to load — any error swaps in the silhouette.
 */

import { useState } from "react";
import Image from "next/image";
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
  srcs,
  alt,
  className,
}: {
  /** Candidate image URLs, tried in order (see headshotSources). */
  srcs: readonly string[];
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState<string[]>([]);
  const src = srcs.find((s) => !failed.includes(s));

  if (!src) return <Silhouette className={className} />;

  return (
    // Proxied through the Next image optimizer (remotePatterns in
    // next.config.ts) so clients never hit the unofficial CDN directly.
    <Image
      src={src}
      alt={alt}
      width={260}
      height={200}
      onError={() => setFailed((f) => [...f, src])}
      className={cn("bg-muted object-cover object-top", className)}
    />
  );
}

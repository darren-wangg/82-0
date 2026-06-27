"use client";

/**
 * A compact mute/unmute control for the synthesized SFX layer. Reads the
 * persisted mute state via useSyncExternalStore (the recommended pattern for
 * browser-only state — no hydration mismatch). Minimal by design: a single
 * icon button, no label, that slots into a header corner.
 */

import { useSyncExternalStore } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { useTranslations } from "next-intl";
import { isMuted, subscribeMuted, toggleMuted } from "@/lib/sfx";
import { cn } from "@/lib/utils";

export function SoundToggle({ className }: { className?: string }) {
  const t = useTranslations("sound");
  // Server + first client paint assume "sound on"; the store reconciles to the
  // real localStorage value right after hydration.
  const muted = useSyncExternalStore(subscribeMuted, isMuted, () => false);

  return (
    <button
      type="button"
      onClick={toggleMuted}
      aria-pressed={muted}
      aria-label={muted ? t("unmute") : t("mute")}
      title={muted ? t("unmute") : t("mute")}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-full border border-border/70 bg-card/60 text-muted-foreground backdrop-blur transition-all active:scale-90 hover:text-foreground",
        className
      )}
    >
      {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
    </button>
  );
}

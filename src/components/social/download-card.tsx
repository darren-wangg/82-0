"use client";

/**
 * Saves the retro team-card PNG. A plain <a download> stores a *file* — on
 * iOS that's the Files app, not the photo library. Where the Web Share API
 * can share files (iOS/Android), we hand the PNG to the share sheet so
 * "Save Image" lands it in Photos; elsewhere we fall back to a normal
 * download.
 *
 * The PNG is prefetched so navigator.share() can run inside the tap's
 * user-activation window (satori takes a few seconds to render the card) —
 * but lazily: a few seconds after mount so the render doesn't compete with
 * the reveal animations, and eagerly on pointerdown/focus as a head start
 * before the click lands.
 */

import { useEffect, useRef, useState } from "react";
import { ImageDown, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/** Delay before the idle prefetch — past the sim screen's reveal sequence. */
const PREFETCH_DELAY_MS = 3500;

export function DownloadCardButton({
  cardUrl,
  fileName,
  label,
  ariaLabel,
  className,
}: {
  cardUrl: string;
  fileName: string;
  /** Empty string renders an icon-only button — pass ariaLabel with it. */
  label: string;
  ariaLabel?: string;
  className?: string;
}) {
  const blobRef = useRef<Blob | null>(null);
  const fetchingRef = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Owner-gated cards 403 for visitors — the button removes itself rather
  // than offering a download that can't succeed.
  const [forbidden, setForbidden] = useState(false);

  const prefetch = () => {
    if (blobRef.current || fetchingRef.current === cardUrl) return;
    fetchingRef.current = cardUrl;
    fetch(cardUrl)
      .then(async (res) => {
        if (res.status === 403) {
          setForbidden(true);
          return;
        }
        if (!res.ok) return;
        const blob = await res.blob();
        if (fetchingRef.current === cardUrl) blobRef.current = blob;
      })
      .catch(() => {
        // prefetch is best-effort; the tap handler refetches
      })
      .finally(() => {
        if (fetchingRef.current === cardUrl) fetchingRef.current = null;
      });
  };

  useEffect(() => {
    blobRef.current = null;
    fetchingRef.current = null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset for the new card URL
    setForbidden(false);
    const t = window.setTimeout(prefetch, PREFETCH_DELAY_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- prefetch is stable per cardUrl
  }, [cardUrl]);

  async function save() {
    if (busy) return;
    setBusy(true);
    try {
      let blob = blobRef.current;
      if (!blob) {
        const res = await fetch(cardUrl);
        if (res.status === 403) {
          setForbidden(true);
          return;
        }
        if (!res.ok) throw new Error(`card fetch failed: ${res.status}`);
        blob = await res.blob();
      }
      blobRef.current = blob;
      const file = new File([blob], fileName, {
        type: blob.type || "image/png",
      });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
          return;
        } catch (err) {
          // User closed the sheet — done. Anything else (e.g. the
          // user-activation window expired) falls through to a download.
          if (err instanceof DOMException && err.name === "AbortError") return;
        }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Couldn't even fetch the image — open it; the user can long-press.
      window.open(cardUrl, "_blank");
    } finally {
      setBusy(false);
    }
  }

  if (forbidden) return null;

  return (
    <button
      type="button"
      onClick={save}
      onPointerDown={prefetch}
      onFocus={prefetch}
      aria-label={ariaLabel}
      className={cn("inline-flex items-center justify-center gap-1.5", className)}
    >
      {busy ? (
        <LoaderCircle aria-hidden className="size-4 animate-spin" />
      ) : (
        <ImageDown aria-hidden className="size-4" />
      )}
      {label}
    </button>
  );
}

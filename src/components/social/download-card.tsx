"use client";

/**
 * Saves the retro team-card PNG. A plain <a download> stores a *file* — on
 * iOS that's the Files app, not the photo library. Where the Web Share API
 * can share files (iOS/Android), we hand the PNG to the share sheet so
 * "Save Image" lands it in Photos; elsewhere we fall back to a normal
 * download.
 *
 * The PNG is prefetched on mount: satori takes a few seconds to render the
 * card, and navigator.share() must run inside the tap's user-activation
 * window — sharing a blob we already hold keeps the tap handler fast enough.
 */

import { useEffect, useRef, useState } from "react";
import { ImageDown, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function DownloadCardButton({
  cardUrl,
  fileName,
  label,
  className,
}: {
  cardUrl: string;
  fileName: string;
  label: string;
  className?: string;
}) {
  const blobRef = useRef<Blob | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(cardUrl)
      .then(async (res) => {
        if (!res.ok) return;
        const blob = await res.blob();
        if (!cancelled) blobRef.current = blob;
      })
      .catch(() => {
        // prefetch is best-effort; the tap handler refetches
      });
    return () => {
      cancelled = true;
    };
  }, [cardUrl]);

  async function save() {
    if (busy) return;
    setBusy(true);
    try {
      const blob = blobRef.current ?? (await (await fetch(cardUrl)).blob());
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

  return (
    <button
      type="button"
      onClick={save}
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

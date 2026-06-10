"use client";

/** Share via navigator.share with a clipboard fallback. */

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ShareButton({
  title,
  path,
  label = "Share",
  className,
}: {
  title: string;
  /** Site-relative path, e.g. /t/abc23456 — absolutized client-side. */
  path: string;
  label?: string;
  className?: string;
}) {
  const [feedback, setFeedback] = useState<string | null>(null);

  async function share() {
    const url = `${window.location.origin}${path}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // Cancelled or unsupported payload — fall through to clipboard.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setFeedback("Link copied!");
    } catch {
      setFeedback(url); // last resort: show the URL so it can be copied by hand
    }
    setTimeout(() => setFeedback(null), 2500);
  }

  return (
    <Button variant="outline" className={className} onClick={share}>
      <span className="truncate">{feedback ?? label}</span>
    </Button>
  );
}

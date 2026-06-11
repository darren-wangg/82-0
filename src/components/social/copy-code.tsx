"use client";

/** Tap-to-copy lobby code chip — the fastest way to invite over chat. */

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // No clipboard access — the code is visible to copy by hand.
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy lobby code ${code}`}
      className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-0.5 font-mono text-xs tracking-widest transition-colors hover:bg-muted active:scale-95"
    >
      {code}
      {copied ? (
        <Check className="size-3 text-emerald-400" />
      ) : (
        <Copy className="size-3 text-muted-foreground" />
      )}
    </button>
  );
}

"use client";

/**
 * Streams an AI explanation from POST /api/explain into the page.
 * Fails softly: a 503 (no ANTHROPIC_API_KEY / no DB) renders a quiet note
 * instead of an error, and any other failure offers a retry.
 */

import { useCallback, useEffect, useState } from "react";
import { ExplainRequest } from "@/lib/contracts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type Status = "loading" | "streaming" | "done" | "unavailable" | "error";

export function ExplainStream({ request }: { request: ExplainRequest }) {
  const requestKey = JSON.stringify(request);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>("loading");
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      setText("");
      setStatus("loading");
      try {
        const res = await fetch("/api/explain", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: requestKey,
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          setStatus(res.status === 503 ? "unavailable" : "error");
          return;
        }
        setStatus("streaming");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          setText((t) => t + decoder.decode(value, { stream: true }));
        }
        setStatus("done");
      } catch {
        if (!controller.signal.aborted) setStatus("error");
      }
    })();

    return () => controller.abort();
  }, [requestKey, attempt]);

  if (status === "unavailable") {
    return (
      <p className="text-xs text-muted-foreground">
        AI breakdowns aren&apos;t available right now.
      </p>
    );
  }

  if (status === "error") {
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Couldn&apos;t load the AI breakdown.
        </p>
        <Button variant="outline" size="sm" onClick={retry}>
          Try again
        </Button>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="space-y-2" aria-busy>
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-11/12" />
        <Skeleton className="h-3 w-4/5" />
      </div>
    );
  }

  return (
    <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
      {text}
      {status === "streaming" && (
        <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-primary align-baseline" />
      )}
    </p>
  );
}

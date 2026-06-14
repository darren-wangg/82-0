"use client";

import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Root error boundary — last-resort fallback for unexpected runtime errors.
 * Expected failures (DB down, missing rows) are handled in-page with
 * <Unavailable /> and notFound(); this only catches what slips through.
 */
export default function RootError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <div className="dark flex min-h-dvh flex-1 flex-col items-center justify-center gap-4 bg-background px-6 text-center font-sans text-foreground">
      <p className="font-display text-7xl tracking-tight text-muted-foreground">
        Foul
      </p>
      <div>
        <h1 className="text-lg font-bold">Something went wrong</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          An error interrupted the play. Your draft is still safe on this device.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button className="rounded-xl" onClick={() => unstable_retry()}>
          Try again
        </Button>
        <Link
          href="/"
          className={cn(buttonVariants({ variant: "outline" }), "rounded-xl")}
        >
          Home
        </Link>
      </div>
    </div>
  );
}

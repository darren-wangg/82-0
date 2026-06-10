/** Friendly soft-failure state for pages whose data couldn't load (e.g. no DB). */

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Unavailable({ what = "this page" }: { what?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-24 text-center">
      <p className="text-4xl">🏀</p>
      <div>
        <h1 className="text-lg font-bold">Couldn&apos;t load right now</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          We couldn&apos;t load {what}. Give it another shot in a moment.
        </p>
      </div>
      <div className="flex gap-2">
        <a href="" className={cn(buttonVariants({ variant: "outline" }))}>
          Try again
        </a>
        <Link href="/play" className={cn(buttonVariants())}>
          Build a team
        </Link>
      </div>
    </div>
  );
}

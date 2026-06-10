import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { HowToPlayDialog } from "@/components/game/how-to-play";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "82-0 — Draft the perfect season",
  description:
    "Spin for a franchise and an era, draft 8 legends, and chase the perfect 82-0 season.",
};

export default function Home() {
  return (
    <div className="dark flex min-h-dvh flex-1 flex-col bg-background text-foreground">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 px-6 pt-16 pb-10">
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-xs font-semibold tracking-[0.35em] text-primary uppercase">
            The draft game
          </p>
          <h1 className="bg-gradient-to-br from-primary via-orange-300 to-violet-400 bg-clip-text font-display text-[6.5rem] leading-none tracking-tight text-transparent tabular-nums">
            82-0
          </h1>
          <p className="max-w-xs text-base text-balance text-muted-foreground">
            Spin for a franchise and an era, draft 8 legends, and chase the
            perfect season.
          </p>
        </div>

        <ul className="grid w-full grid-cols-3 gap-2 text-center text-[11px] text-muted-foreground">
          <li className="rounded-xl border border-primary/30 bg-primary/10 px-2 py-3">
            <span className="block font-display text-xl text-primary">8</span>
            slot-machine spins
          </li>
          <li className="rounded-xl border border-violet-400/30 bg-violet-400/10 px-2 py-3">
            <span className="block font-display text-xl text-violet-300">5+3</span>
            starters &amp; bench
          </li>
          <li className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-2 py-3">
            <span className="block font-display text-xl text-emerald-300">82</span>
            games simulated
          </li>
        </ul>

        <div className="flex w-full flex-col items-center gap-3 pt-2">
          <Link
            href="/play"
            className={cn(
              buttonVariants({ size: "lg" }),
              "h-14 w-full rounded-2xl font-display text-xl tracking-wide shadow-lg shadow-primary/30"
            )}
          >
            Start Draft
          </Link>
          <HowToPlayDialog />
        </div>
      </main>
    </div>
  );
}

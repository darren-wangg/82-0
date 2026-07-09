import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state for /budget/leaderboard — mirrors the page: header + size
 * switch, the cap + scope tab rows, and a column of ranked rows.
 */
export default function BudgetLeaderboardLoading() {
  return (
    <div className="dark flex min-h-svh flex-1 flex-col bg-background text-foreground">
      <main
        className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-5 pb-12"
        aria-busy
      >
        <div className="flex items-start justify-between gap-3">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-7 w-28 rounded-lg" />
        </div>

        {/* cap tabs */}
        <div className="mt-4 grid grid-cols-3 gap-1 rounded-xl bg-muted/60 p-1">
          <Skeleton className="h-7 rounded-lg" />
          <Skeleton className="h-7 rounded-lg" />
          <Skeleton className="h-7 rounded-lg" />
        </div>

        {/* scope tabs */}
        <div className="mt-2 grid grid-cols-2 gap-1 rounded-xl bg-muted/60 p-1">
          <Skeleton className="h-7 rounded-lg" />
          <Skeleton className="h-7 rounded-lg" />
        </div>

        {/* ranked rows */}
        <ol className="mt-4 space-y-1.5">
          {Array.from({ length: 8 }, (_, i) => (
            <li
              key={i}
              className="flex items-center gap-3 rounded-xl border border-border/80 bg-card/70 px-3 py-2.5"
            >
              <Skeleton className="h-4 w-5 shrink-0" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-2.5 w-20" />
              </div>
              <Skeleton className="h-4 w-10 shrink-0" />
              <Skeleton className="h-3 w-12 shrink-0" />
            </li>
          ))}
        </ol>
      </main>
    </div>
  );
}

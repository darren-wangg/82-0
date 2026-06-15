import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state for /m/[id] — mirrors the matchup page: the two-team header
 * with the series score, category edges, and the streamed recap.
 */
export default function MatchupLoading() {
  return (
    <main className="space-y-5" aria-busy>
      <div className="flex justify-center">
        <Skeleton className="h-3 w-40" />
      </div>

      {/* team A · score · team B */}
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-14" />
        </div>
        <Skeleton className="h-12 w-20 shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col items-end gap-1">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-14" />
        </div>
      </div>

      {/* category edges */}
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-28" />
        </CardHeader>
        <CardContent className="space-y-1.5">
          {Array.from({ length: 9 }, (_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-3 w-20 shrink-0" />
              <Skeleton className="h-2 flex-1 rounded-full" />
              <Skeleton className="h-3 w-8 shrink-0" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* series recap */}
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-11/12" />
          <Skeleton className="h-3 w-4/5" />
        </CardContent>
      </Card>

      <div className="space-y-2">
        <Skeleton className="h-11 w-full rounded-xl" />
        <Skeleton className="h-11 w-full rounded-xl" />
      </div>
    </main>
  );
}

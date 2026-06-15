import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state for /t/[slug] — mirrors the team page: title, record hero,
 * roster grid, 9-cat profile, scouting report, and the CTA stack.
 */
export default function TeamLoading() {
  return (
    <main className="space-y-5" aria-busy>
      {/* title + byline */}
      <div className="flex flex-col items-center gap-1.5">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-3 w-32" />
      </div>

      {/* record hero: big W–L, then OVR/OFF/DEF tiles */}
      <div className="space-y-3">
        <div className="flex flex-col items-center gap-1.5">
          <Skeleton className="h-12 w-36" />
          <Skeleton className="h-2.5 w-28" />
        </div>
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12 flex-1 rounded-xl" />
          ))}
        </div>
      </div>

      {/* roster grid (3-up player cards) */}
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="aspect-[13/10] w-full rounded-xl" />
        ))}
      </div>

      {/* category profile */}
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-32" />
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

      {/* scouting report */}
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-28" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-11/12" />
          <Skeleton className="h-3 w-4/5" />
        </CardContent>
      </Card>

      {/* CTAs */}
      <div className="space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-11 w-full rounded-xl" />
        ))}
      </div>
    </main>
  );
}

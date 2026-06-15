import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state for /l/[code] — mirrors the lobby page: centered name + meta,
 * a highlighted leader/seat card, the standings table, and the primary action.
 */
export default function LobbyLoading() {
  return (
    <main className="space-y-5" aria-busy>
      {/* lobby name + meta lines */}
      <div className="flex flex-col items-center gap-1.5">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-4 w-24 rounded-md" />
      </div>

      {/* leader / status card */}
      <Card>
        <CardContent className="flex items-center gap-3 py-4">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
        </CardContent>
      </Card>

      {/* primary action */}
      <Skeleton className="h-14 w-full rounded-2xl" />

      {/* standings */}
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 border-t border-border/60 pt-2 first:border-0 first:pt-0">
              <Skeleton className="h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1 space-y-1">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-2.5 w-20" />
              </div>
              <Skeleton className="h-3.5 w-10 shrink-0" />
              <Skeleton className="h-3.5 w-8 shrink-0" />
            </div>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}

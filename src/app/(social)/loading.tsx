import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shared loading state for the social surfaces (/t, /m, /l, /leaderboard) —
 * they all fetch from the database server-side, so navigation would otherwise
 * sit on a blank column.
 */
export default function SocialLoading() {
  return (
    <main className="flex flex-1 flex-col gap-5" aria-busy>
      <div className="flex flex-col items-center gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
      <Skeleton className="h-11 w-full rounded-xl" />
    </main>
  );
}

import { Skeleton } from "@/components/ui/skeleton";

/**
 * Neutral fallback loading state for social routes without a more specific
 * `loading.tsx` (e.g. /l/new, /teams — both of which also render their own
 * in-component skeleton once mounted). Route-specific skeletons live alongside
 * their pages (leaderboard, /t, /m, /l/[code]).
 */
export default function SocialLoading() {
  return (
    <main className="flex flex-1 flex-col gap-4" aria-busy>
      <Skeleton className="h-8 w-40" />
      <div className="space-y-1.5">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    </main>
  );
}

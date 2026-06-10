import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Root 404 — covers unmatched routes outside the (social) group, which has
 * its own not-found inside the social shell. Root layout has no chrome, so
 * this brings its own dark full-height wrapper.
 */
export default function NotFound() {
  return (
    <div className="dark flex min-h-dvh flex-1 flex-col items-center justify-center gap-4 bg-background px-6 text-center font-sans text-foreground">
      <p className="font-display text-7xl tracking-tight text-muted-foreground">
        0-82
      </p>
      <div>
        <h1 className="text-lg font-bold">Nothing here</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          That page doesn&apos;t exist — but a perfect season might.
        </p>
      </div>
      <Link href="/" className={cn(buttonVariants(), "rounded-xl")}>
        Back to the game
      </Link>
    </div>
  );
}

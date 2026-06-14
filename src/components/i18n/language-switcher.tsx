"use client";

/**
 * Minimal language control — lives only on the home screen. Writes the locale
 * to the `ud:locale` cookie and refreshes so every Server/Client Component
 * re-renders with the new dictionary. Kept low-chrome: a small inline select.
 */

import { useTransition } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { LOCALE_COOKIE, LOCALE_NAMES, LOCALES } from "@/i18n/config";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({
  className,
  label,
}: {
  className?: string;
  /** Accessible label (localized by the caller). */
  label: string;
}) {
  const router = useRouter();
  const locale = useLocale();
  const [pending, startTransition] = useTransition();

  const onChange = (next: string) => {
    // 1-year cookie; SameSite=Lax is enough for a non-sensitive preference.
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  };

  return (
    <label
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground",
        pending && "opacity-60",
        className
      )}
    >
      <Languages aria-hidden className="size-3.5" />
      <span className="sr-only">{label}</span>
      <select
        value={locale}
        onChange={(e) => onChange(e.target.value)}
        disabled={pending}
        aria-label={label}
        className="rounded-md border border-border bg-card px-1.5 py-0.5 text-[11px] font-semibold text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {LOCALE_NAMES[l]}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Locale configuration for the cookie-driven i18n setup (no URL routing).
 * The active locale lives in a cookie; `src/i18n/request.ts` reads it on the
 * server and `LanguageSwitcher` writes it on the client.
 */

export const LOCALES = ["en", "es", "fr", "de", "it", "pt"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Cookie that holds the chosen locale (namespaced like the app's others). */
export const LOCALE_COOKIE = "ud:locale";

/** Human-readable names for the switcher, shown in each language's own script. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  pt: "Português",
};

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

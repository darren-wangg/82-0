/**
 * next-intl request config (cookie mode, no i18n routing). Resolves the active
 * locale from the `ud:locale` cookie — falling back to the default — and loads
 * that locale's message catalog for both Server and Client Components.
 *
 * Reading the cookie here opts pages that render translations into dynamic
 * rendering; that's the accepted tradeoff for switching language without a URL
 * prefix (see docs/scaling.md note).
 */

import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from "./config";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const requested = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(requested) ? requested : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});

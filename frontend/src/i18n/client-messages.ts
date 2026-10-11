/**
 * Namespaces that only server components read (`getTranslations`); no client component calls `useTranslations` for them.
 * They are left out of the messages the root layout hands to `NextIntlClientProvider`, because everything given to the
 * provider is serialised into the HTML of every page (and re-parsed on hydration). `publicPages` alone is ~30 % of the
 * catalogue. If a client component ever needs one of these, remove it from this list.
 */
export const SERVER_ONLY_NAMESPACES = ["publicPages", "brand"] as const;

/** The full merged catalogue (see `i18n/request.ts`) without the server-only namespaces. */
export function clientMessages<T extends Record<string, unknown>>(messages: T): Partial<T> {
  const entries = Object.entries(messages).filter(([namespace]) => !(SERVER_ONLY_NAMESPACES as readonly string[]).includes(namespace));
  return Object.fromEntries(entries) as Partial<T>;
}

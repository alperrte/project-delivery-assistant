import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from "./config";

async function resolveLocale(): Promise<Locale> {
  // The URL locale passed by the page proxy wins over an older preference cookie.
  const routed = (await headers()).get("x-pda-locale");
  if (isLocale(routed)) return routed;
  const stored = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(stored)) return stored;

  const accepted = (await headers()).get("accept-language") ?? "";
  for (const part of accepted.split(",")) {
    const code = part.trim().slice(0, 2).toLowerCase();
    if (isLocale(code)) return code;
  }
  return defaultLocale;
}

type Messages = { [key: string]: string | Messages };

function isBranch(value: unknown): value is Messages {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** `base` with every key of `override` laid over it, nested objects merged key by key. */
function mergeMessages(base: Messages, override: Messages): Messages {
  const merged: Messages = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = merged[key];
    merged[key] = isBranch(value) && isBranch(current) ? mergeMessages(current, value) : value;
  }
  return merged;
}

async function loadCatalog(locale: Locale): Promise<Messages> {
  return {
    ...(await import(`./messages/${locale}.json`)).default,
    errorPages: (await import(`./errors/${locale}.json`)).default,
    landing: (await import(`./landing/${locale}.json`)).default,
  };
}

/**
 * A key missing from the visitor's language is shown in the default language instead of as a raw key (the messages are merged
 * over the default catalog before they reach server and client components alike). A key missing from the default language
 * too, or a broken message, is logged on the server and rendered as its dotted path instead of throwing.
 */
export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  const own = await loadCatalog(locale);
  return {
    locale,
    messages: locale === defaultLocale ? own : mergeMessages(await loadCatalog(defaultLocale), own),
    onError(error) {
      console.warn(`[i18n] ${error.message}`);
    },
    getMessageFallback({ namespace, key }) {
      return [namespace, key].filter(Boolean).join(".");
    },
  };
});

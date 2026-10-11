import { LOCALE_COOKIE, type Locale } from "./config";

export function writeLocaleCookie(locale: Locale) {
  // `Secure` on an https page: a language preference should never travel over plain http either.
  const secure = window.location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax${secure}`;
}

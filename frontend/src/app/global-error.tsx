"use client";

import { useSyncExternalStore } from "react";
import { ErrorContent } from "@/features/errors/error-content";
import { isLocale, LOCALE_COOKIE } from "@/i18n/config";
import tr from "@/i18n/errors/tr.json";
import en from "@/i18n/errors/en.json";
import de from "@/i18n/errors/de.json";
import "./globals.css";

const subscribe = () => () => {};
const copies = { tr, en, de };

function readLocale() {
  const cookie = document.cookie.split("; ").find(row => row.startsWith(`${LOCALE_COOKIE}=`))?.split("=")[1];
  if (isLocale(cookie)) return cookie;
  const language = navigator.language.slice(0, 2).toLowerCase();
  return isLocale(language) ? language : "tr";
}

function readDark() {
  try {
    const theme = localStorage.getItem("theme");
    if (theme === "dark" || theme === "light") return theme === "dark";
  } catch { /* Fall back to the device preference. */ }
  return matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Root-layout failures must not depend on NextIntl, ThemeProvider or session queries. */
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const locale = useSyncExternalStore(subscribe, readLocale, () => "tr" as const);
  const dark = useSyncExternalStore(subscribe, readDark, () => false);
  const copy = copies[locale];
  return (
    <html lang={locale} className={dark ? "dark" : undefined}>
      <head><title>500 · PDA</title><meta name="robots" content="noindex, nofollow" /></head>
      <body className="min-h-[100dvh] bg-background text-foreground" style={{ fontFamily: "system-ui, sans-serif" }}>
        <header className="mx-auto w-full max-w-6xl px-6 py-6 sm:px-10"><a href="/login" className="inline-flex min-h-11 items-center rounded-md text-lg font-semibold outline-hidden focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">PDA · Project Delivery Assistant</a></header>
        <main className="flex min-h-[75dvh] items-center px-6 sm:px-10"><ErrorContent code="500" copy={copy} onRetry={retry} /></main>
      </body>
    </html>
  );
}

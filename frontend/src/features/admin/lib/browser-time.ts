import { useSyncExternalStore } from "react";

const subscribeNever = () => () => {};

/** The browser's IANA time zone, read after hydration only (the server render has none). `null` until then. */
export function useBrowserZone(): string | null {
  return useSyncExternalStore(subscribeNever, () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", () => null);
}

/** "YYYY-MM-DD" of a date in the browser's own calendar. */
export function localDay(date: Date) {
  return `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Days from `from` to `to`, both included. */
export function daysBetween(from: string, to: string) {
  return Math.round((new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86_400_000) + 1;
}

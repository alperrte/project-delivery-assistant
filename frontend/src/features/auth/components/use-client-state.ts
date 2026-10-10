import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** False on the server and during hydration, true afterwards: browser-only values may be read once this is true. */
export function useMounted(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

/**
 * The page's query string, or null until mounted. It is client-only (the pages are statically rendered), and reading
 * it this way keeps the server markup and the first client render identical.
 */
export function useQueryParams(): URLSearchParams | null {
  const search = useSyncExternalStore(subscribe, () => window.location.search, () => null);
  return search === null ? null : new URLSearchParams(search);
}

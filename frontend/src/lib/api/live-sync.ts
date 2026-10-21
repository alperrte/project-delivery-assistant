import type { Query, QueryKey } from "@tanstack/react-query";
import { ApiError } from "./client";

/** How often a mounted, visible workspace list re-reads the server so other people's changes show up without F5. */
export const LIVE_REFRESH_MS = 15_000;
/** A failing live query backs off up to this far instead of hammering a struggling server. */
const MAX_BACKOFF_MS = 120_000;

/**
 * Query families that follow the server: projects and everything under them (tasks, criteria, teams, members, overview,
 * sprints, labels, reminders), the cross-project task views (Görevlerim, pool, counters) and organizations.
 * Auth/session, chat, meetings, notifications and invitations are not listed: they sit under other roots and keep the
 * dedicated timers (or the realtime channel) they already have.
 */
const LIVE_ROOTS: ReadonlySet<unknown> = new Set(["projects", "tasks", "organizations"]);

/**
 * Parts of a live family that must stay still: the repository tab talks to GitHub (rate limited), pickers and
 * candidate searches follow what the user is typing, and the open project switcher must not reshuffle under the cursor.
 */
const STILL_SEGMENTS: ReadonlySet<unknown> = new Set(["repository", "candidates", "picker", "sidebar-switcher"]);

/**
 * Spread into a query that feeds a form: it must not be re-read under the user's hands (an open editor would be reset
 * or replaced by an error page), neither on a timer nor when the tab regains focus.
 */
export const STILL_QUERY = { refetchInterval: false, refetchOnWindowFocus: false } as const;

export function isLiveQueryKey(queryKey: QueryKey): boolean {
  return LIVE_ROOTS.has(queryKey[0]) && !queryKey.some(part => STILL_SEGMENTS.has(part));
}

/** A client error will answer the same way next time (gone, forbidden, invalid); only 408/429 can recover by waiting. */
const isPermanentFailure = (error: unknown) =>
  error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429;

/**
 * Default `refetchInterval`: live families re-read every `LIVE_REFRESH_MS` while the tab is visible (TanStack never
 * polls a hidden tab unless `refetchIntervalInBackground` is set, which is left off), back off exponentially while the
 * server keeps failing, and stop on answers that cannot change by themselves. A query that sets its own interval, or
 * `false` (forms that must not be overwritten while being edited), simply overrides this.
 */
export function liveRefetchInterval(query: Query): number | false {
  if (!isLiveQueryKey(query.queryKey)) return false;
  if (isPermanentFailure(query.state.error)) return false;
  const failures = query.state.fetchFailureCount;
  return failures > 0 ? Math.min(LIVE_REFRESH_MS * 2 ** failures, MAX_BACKOFF_MS) : LIVE_REFRESH_MS;
}

/**
 * Default `refetchOnWindowFocus`: coming back to the tab revalidates live families once they are stale
 * (`staleTime` still applies, so quick tab flips cost nothing). Other families keep their current behaviour.
 */
export function liveRefetchOnFocus(query: Query): boolean {
  return isLiveQueryKey(query.queryKey);
}

/**
 * Whether a page should replace its content with an error. A failed *background* refresh (a dropped connection, a 5xx)
 * leaves the last good data on screen and retries on its own; only a first load that failed, or an answer that will not
 * change by waiting (the item is gone, access was lost), takes the page over.
 */
export function hasBlockingError(query: { isError: boolean; data: unknown; error: unknown }): boolean {
  return query.isError && (query.data === undefined || isPermanentFailure(query.error));
}

"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth/hooks/use-session";
import { ApiError } from "@/lib/api/client";
import { projectsApi } from "../api";

const SELECTION_EVENT = "pda:project-selection-changed";
const KEY_PREFIX = "pda:last-project:";
const storageKey = (userId: string) => `${KEY_PREFIX}${userId}`;

/** Only a plain slug is ever stored; anything else read back (edited by hand, an older format) is ignored. */
const isSlug = (value: string | null): value is string => !!value && value.length <= 200 && !/[\s/?#]/.test(value);

/** Storage can be missing or throw (private windows, blocked site data); the selection then simply is not remembered. */
function read(area: () => Storage, key: string): string | null {
  try { return area().getItem(key); } catch { return null; }
}

function write(area: () => Storage, key: string, value: string | null) {
  try {
    if (value === null) area().removeItem(key); else area().setItem(key, value);
  } catch { /* the in-memory query cache still holds the selection for this tab */ }
}

const local = () => localStorage;
const session = () => sessionStorage;

/**
 * The remembered slug of one account. It lives in `localStorage` so a new tab and a reopened browser keep it; it is a
 * non-sensitive UI preference scoped to the account id, never a token or any API data. The tab-scoped `sessionStorage`
 * copy of earlier versions is still honoured until `migrateLegacySelection` has moved it.
 */
function readRemembered(userId: string): string | null {
  const key = storageKey(userId);
  const stored = read(local, key) ?? read(session, key);
  return isSlug(stored) ? stored : null;
}

/** One-time move of the old per-tab selection into the shared one; an existing shared choice always wins. */
function migrateLegacySelection(userId: string) {
  const key = storageKey(userId);
  const legacy = read(session, key);
  if (legacy === null) return;
  if (read(local, key) === null && isSlug(legacy)) {
    write(local, key, legacy);
    window.dispatchEvent(new Event(SELECTION_EVENT));
  }
  write(session, key, null);
}

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.storageArea !== null && event.storageArea !== localStorage) return;
    if (event.key === null || event.key.startsWith(KEY_PREFIX)) onChange();
  };
  window.addEventListener(SELECTION_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(SELECTION_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function rememberProject(userId: string, slug: string) {
  if (!isSlug(slug) || readRemembered(userId) === slug) return;
  write(local, storageKey(userId), slug);
  write(session, storageKey(userId), null);
  window.dispatchEvent(new Event(SELECTION_EVENT));
}

/**
 * Drops the remembered project (only when it is `slug`, if one is given) and tells every open sidebar/calendar, so
 * they fall back to the user's first project instead of linking a project that is gone or no longer accessible.
 */
export function forgetSelectedProject(userId: string, slug?: string) {
  const current = readRemembered(userId);
  if (current === null || (slug !== undefined && current !== slug)) return;
  write(local, storageKey(userId), null);
  write(session, storageKey(userId), null);
  window.dispatchEvent(new Event(SELECTION_EVENT));
}

/** The project no longer exists (404) or the user lost access to it (403): nothing to select there any more. */
const isUnavailable = (error: unknown) => error instanceof ApiError && (error.status === 404 || error.status === 403);

/**
 * The project the workspace is currently "in": the one named by the URL when there is one, else the one the user
 * last opened (kept per account across tabs and visits), else their first project. The sidebar and the calendar share
 * this, so switching project in one is reflected in the other, and in other tabs without moving the URL they show.
 */
export function useSelectedProject(routeSlug?: string) {
  const client = useQueryClient();
  const { data: user } = useSession();
  const userId = user?.id;
  const rememberedSlug = useSyncExternalStore(
    subscribe,
    () => (userId ? readRemembered(userId) : null),
    () => null,
  );
  // The first-project fallback is only needed while nothing else names a project.
  const needsDefault = !!userId && !routeSlug && !rememberedSlug;
  const { data: projectList, isPending: defaultPending } = useQuery({
    queryKey: ["projects", "sidebar-default", userId],
    queryFn: ({ signal }) => projectsApi.list(0, 1, signal),
    enabled: needsDefault,
  });
  const slug = routeSlug ?? rememberedSlug ?? projectList?.content[0]?.slug;
  const { data, isError, error, isPending } = useQuery({
    queryKey: ["projects", "selected", userId, slug],
    queryFn: ({ signal }) => projectsApi.bySlug(slug!, signal),
    enabled: !!userId && !!slug,
  });
  // A failed refetch keeps the last good data; for a deleted/forbidden project that would keep it selected.
  const unavailable = isError && isUnavailable(error);
  const project = unavailable ? undefined : data;
  const staleRemembered = unavailable && !routeSlug && !!slug && slug === rememberedSlug;

  useEffect(() => {
    if (userId) migrateLegacySelection(userId);
  }, [userId]);

  useEffect(() => {
    if (userId && staleRemembered) {
      forgetSelectedProject(userId, rememberedSlug!);
      void client.invalidateQueries({ queryKey: ["projects", "sidebar-default", userId] });
    }
  }, [userId, staleRemembered, rememberedSlug, client]);

  useEffect(() => {
    if (userId && routeSlug && project?.slug === routeSlug) rememberProject(userId, routeSlug);
  }, [routeSlug, userId, project?.slug]);

  const select = useCallback((next: string) => {
    if (userId) rememberProject(userId, next);
  }, [userId]);

  // No slug yet only means "still looking" while the user's project list is on its way.
  const isResolving = !userId || (!slug && needsDefault && defaultPending) || (!!slug && isPending);

  return { slug: project?.slug, project, isError, error, isResolving, select };
}

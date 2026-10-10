"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/auth/hooks/use-session";
import { ApiError } from "@/lib/api/client";
import { projectsApi } from "../api";

const SELECTION_EVENT = "pda:project-selection-changed";
const storageKey = (userId: string) => `pda:last-project:${userId}`;

function subscribe(onChange: () => void) {
  window.addEventListener(SELECTION_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(SELECTION_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function rememberProject(userId: string, slug: string) {
  if (sessionStorage.getItem(storageKey(userId)) === slug) return;
  sessionStorage.setItem(storageKey(userId), slug);
  window.dispatchEvent(new Event(SELECTION_EVENT));
}

/**
 * Drops the remembered project (only when it is `slug`, if one is given) and tells every open sidebar/calendar, so
 * they fall back to the user's first project instead of linking a project that is gone or no longer accessible.
 */
export function forgetSelectedProject(userId: string, slug?: string) {
  const current = sessionStorage.getItem(storageKey(userId));
  if (current === null || (slug !== undefined && current !== slug)) return;
  sessionStorage.removeItem(storageKey(userId));
  window.dispatchEvent(new Event(SELECTION_EVENT));
}

/** The project no longer exists (404) or the user lost access to it (403): nothing to select there any more. */
const isUnavailable = (error: unknown) => error instanceof ApiError && (error.status === 404 || error.status === 403);

/**
 * The project the workspace is currently "in": the one named by the URL when there is one, else the one the user
 * last opened in this browser session, else their first project. The sidebar and the calendar share this, so
 * switching project in one is reflected in the other.
 */
export function useSelectedProject(routeSlug?: string) {
  const { data: user } = useSession();
  const userId = user?.id;
  const rememberedSlug = useSyncExternalStore(
    subscribe,
    () => (userId ? sessionStorage.getItem(storageKey(userId)) : null),
    () => null,
  );
  const { data: projectList, isPending: listPending } = useQuery({
    queryKey: ["projects", "sidebar-default", userId],
    queryFn: () => projectsApi.list(0, 1),
    enabled: !!userId,
  });
  const slug = routeSlug ?? rememberedSlug ?? projectList?.content[0]?.slug;
  const { data, isError, error } = useQuery({
    queryKey: ["projects", "by-slug", slug],
    queryFn: () => projectsApi.bySlug(slug!),
    enabled: !!slug,
  });
  // A failed refetch keeps the last good data; for a deleted/forbidden project that would keep it selected.
  const unavailable = isError && isUnavailable(error);
  const project = unavailable ? undefined : data;
  const staleRemembered = unavailable && !routeSlug && !!slug && slug === rememberedSlug;

  useEffect(() => {
    if (userId && staleRemembered) forgetSelectedProject(userId, rememberedSlug!);
  }, [userId, staleRemembered, rememberedSlug]);

  useEffect(() => {
    if (userId && routeSlug) rememberProject(userId, routeSlug);
  }, [routeSlug, userId]);

  const select = useCallback((next: string) => {
    if (userId) rememberProject(userId, next);
  }, [userId]);

  // No slug yet only means "still looking" while the user's project list is on its way.
  const isResolving = !slug && (!userId || listPending);

  return { slug: unavailable ? undefined : slug, project, isError, error, isResolving, select };
}

"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/auth/hooks/use-session";
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
  const { data: project, isError } = useQuery({
    queryKey: ["projects", "by-slug", slug],
    queryFn: () => projectsApi.bySlug(slug!),
    enabled: !!slug,
  });

  useEffect(() => {
    if (userId && routeSlug) rememberProject(userId, routeSlug);
  }, [routeSlug, userId]);

  const select = useCallback((next: string) => {
    if (userId) rememberProject(userId, next);
  }, [userId]);

  // No slug yet only means "still looking" while the user's project list is on its way.
  const isResolving = !slug && (!userId || listPending);

  return { slug, project, isError, isResolving, select };
}

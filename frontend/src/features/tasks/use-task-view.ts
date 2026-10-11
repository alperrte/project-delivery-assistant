"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useSession } from "@/features/auth/hooks/use-session";

/** Cards or a table; Görevler and Görevlerim each remember their own choice per account. */
export type TaskView = "grid" | "table";
export type TaskViewScope = "tasks" | "my-tasks";

const storageKey = (scope: TaskViewScope, userId: string) => `pda:${scope}-view:v1:${userId}`;

export function parseTaskView(value: string | null | undefined): TaskView | null {
  return value === "grid" || value === "table" ? value : null;
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function read(scope: TaskViewScope, userId: string | undefined): TaskView | null {
  if (!userId) return null;
  try {
    return parseTaskView(window.localStorage.getItem(storageKey(scope, userId)));
  } catch {
    // Storage can be blocked; the page default is a fine fallback.
    return null;
  }
}

/** The saved choice is read on the client only, so the server snapshot is `null` and hydration agrees. */
export function useTaskView(scope: TaskViewScope, fallback: TaskView) {
  const userId = useSession().data?.id;
  const remembered = useSyncExternalStore(subscribe, () => read(scope, userId), () => null);

  const setView = useCallback((next: TaskView) => {
    if (!userId) return;
    try {
      window.localStorage.setItem(storageKey(scope, userId), next);
    } catch {
      // Not remembering the choice is harmless.
    }
    listeners.forEach((listener) => listener());
  }, [scope, userId]);

  return { view: remembered ?? fallback, setView };
}

"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useSession } from "@/features/auth/hooks/use-session";

const storageKey = (userId: string) => `pda:board-hide-done:v1:${userId}`;

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function read(userId: string | undefined) {
  if (!userId) return false;
  try {
    return window.localStorage.getItem(storageKey(userId)) === "1";
  } catch {
    // Storage can be blocked; showing every column is a fine fallback.
    return false;
  }
}

/** Whether the board leaves the cards of the Done column out; remembered per account, read on the client only. */
export function useBoardHideDone() {
  const userId = useSession().data?.id;
  const hideDone = useSyncExternalStore(subscribe, () => read(userId), () => false);

  const setHideDone = useCallback((next: boolean) => {
    if (!userId) return;
    try {
      if (next) window.localStorage.setItem(storageKey(userId), "1");
      else window.localStorage.removeItem(storageKey(userId));
    } catch {
      // Not remembering the choice is harmless.
    }
    listeners.forEach((listener) => listener());
  }, [userId]);

  return { hideDone, setHideDone };
}

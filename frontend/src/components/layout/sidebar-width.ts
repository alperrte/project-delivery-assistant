"use client";
import { useCallback, useSyncExternalStore } from "react";
import { useSession } from "@/features/auth/hooks/use-session";
const memory = new Map<string, number>(), listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  const storage = (event: StorageEvent) => { if (event.key) memory.delete(event.key); else memory.clear(); listener(); };
  window.addEventListener("storage", storage); window.addEventListener("resize", listener);
  return () => { listeners.delete(listener); window.removeEventListener("storage", storage); window.removeEventListener("resize", listener); };
}
function maximum() { return Math.max(200, Math.min(420, Math.floor(window.innerWidth * .4))); }
export function useSidebarWidth() {
  const accountId = useSession().data?.id;
  const key = `pda:sidebar-width:v1:${accountId ?? "none"}`;
  const width = useSyncExternalStore(subscribe, () => {
    let value = memory.get(key);
    try { value ??= Number(window.localStorage.getItem(key)) || 240; } catch { /* Default while storage is blocked. */ }
    return Math.max(200, Math.min(maximum(), Number.isFinite(value) ? value! : 240));
  }, () => 240);
  const max = useSyncExternalStore(subscribe, maximum, () => 420);
  const setWidth = useCallback((next: number, persist = true) => {
    if (!accountId) return;
    const value = Math.max(200, Math.min(maximum(), Math.round(next)));
    memory.set(key, value);
    if (persist) try { window.localStorage.setItem(key, String(value)); } catch { /* Memory fallback. */ }
    listeners.forEach(listener => listener());
  }, [accountId, key]);
  return { width, max, setWidth };
}

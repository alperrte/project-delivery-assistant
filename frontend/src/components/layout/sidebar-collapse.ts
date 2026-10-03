"use client";

import { useSyncExternalStore } from "react";

export const COLLAPSE_KEY = "pda:sidebar-collapsed";
export const collapseEvent = "pda:sidebar-collapsed-changed";

function subscribeToCollapse(onChange: () => void) {
  window.addEventListener(collapseEvent, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(collapseEvent, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Whether the desktop sidebar is collapsed to its 64 px icon rail. The server snapshot is always "expanded" so
 * hydration never mismatches; the stored preference (if collapsed) applies a frame later. The app shell and anything
 * positioned next to the sidebar (the chat panel) read the same value.
 */
export function useSidebarCollapsed(): boolean {
  return useSyncExternalStore(subscribeToCollapse, readCollapsed, () => false);
}

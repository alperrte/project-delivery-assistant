"use client";

import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}

function snapshot() {
  return new URLSearchParams(window.location.hash.slice(1)).get("invitation");
}

export function useInvitationToken() {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}

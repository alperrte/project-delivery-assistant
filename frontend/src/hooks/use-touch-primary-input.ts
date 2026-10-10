"use client";

import { useSyncExternalStore } from "react";

const TOUCH_QUERY = "(pointer: coarse) and (hover: none)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(TOUCH_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * True on devices whose primary input is a finger (coarse pointer, no hover), where Enter on a soft keyboard should
 * mean "new line" and sending goes through a button. The server render and the first client render assume a desktop.
 */
export function useTouchPrimaryInput(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(TOUCH_QUERY).matches,
    () => false,
  );
}

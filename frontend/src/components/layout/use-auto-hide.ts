"use client";

import { useEffect, useRef, useState } from "react";

const IDLE_MS = 700;
const TOP_ZONE_PX = 24;
const SCROLL_HIDE_DELTA = 80;

/**
 * Drives the floating navbar's show/hide state. Desktop: hides after
 * `IDLE_MS` once the cursor is away from the header and the top edge, or on a
 * scroll-down past `SCROLL_HIDE_DELTA`px; comes back on cursor-to-top,
 * scroll-up, focus landing inside the header, or Ctrl/Cmd+K. Never hides
 * while the header is hovered/focused or one of its own popups (a dropdown
 * trigger with `data-popup-open`/`aria-expanded="true"`, or the search panel
 * marking itself the same way) is open. Touch (`hover: none`): no idle hide,
 * scroll direction only. The CSS transition itself collapses to ~0 under
 * `prefers-reduced-motion` via the site-wide rule in globals.css, so this
 * hook does not need its own reduced-motion branch.
 */
export function useAutoHide<T extends HTMLElement>(enabled = true) {
  const ref = useRef<T>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || !enabled) return;

    const touch = matchMedia("(hover: none)").matches;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    let hovered = false;
    let inTopZone = false;
    let lastScrollY = window.scrollY;

    function clearIdle() {
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
    }

    function stayOpen() {
      return (
        hovered ||
        node!.contains(document.activeElement) ||
        !!node!.querySelector("[data-popup-open], [aria-expanded='true']")
      );
    }

    function show() {
      clearIdle();
      setHidden(false);
    }

    function scheduleHide() {
      clearIdle();
      if (touch) return;
      idleTimer = setTimeout(() => {
        if (!stayOpen()) setHidden(true);
      }, IDLE_MS);
    }

    function onPointerMove(event: PointerEvent) {
      if (touch) return;
      const now = event.clientY <= TOP_ZONE_PX;
      if (now && !inTopZone) {
        inTopZone = true;
        show();
      } else if (!now && inTopZone) {
        inTopZone = false;
        if (!hovered) scheduleHide();
      }
    }

    function onPointerEnter() {
      hovered = true;
      show();
    }

    function onPointerLeave() {
      hovered = false;
      scheduleHide();
    }

    function onFocusIn() {
      show();
    }

    function onFocusOut() {
      // Let focus land on the next header child before deciding it truly left.
      requestAnimationFrame(() => {
        if (!stayOpen()) scheduleHide();
      });
    }

    function onScroll() {
      const y = window.scrollY;
      const delta = y - lastScrollY;
      lastScrollY = y;
      if (delta > 0 && y > SCROLL_HIDE_DELTA && !stayOpen()) {
        clearIdle();
        setHidden(true);
      } else if (delta < 0) {
        show();
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") show();
    }

    window.addEventListener("pointermove", onPointerMove);
    node.addEventListener("pointerenter", onPointerEnter);
    node.addEventListener("pointerleave", onPointerLeave);
    node.addEventListener("focusin", onFocusIn);
    node.addEventListener("focusout", onFocusOut);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("keydown", onKeyDown);

    if (!touch) scheduleHide();

    return () => {
      clearIdle();
      window.removeEventListener("pointermove", onPointerMove);
      node.removeEventListener("pointerenter", onPointerEnter);
      node.removeEventListener("pointerleave", onPointerLeave);
      node.removeEventListener("focusin", onFocusIn);
      node.removeEventListener("focusout", onFocusOut);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [enabled]);

  return { ref, hidden, reveal: () => setHidden(false) };
}

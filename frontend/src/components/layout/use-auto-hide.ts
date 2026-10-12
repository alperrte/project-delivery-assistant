"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { NavbarMode } from "@/features/settings/api";

export const NAVBAR_IDLE_MS = 700;
const TOP_ZONE_PX = 24;
const SCROLL_HIDE_DELTA = 80;
const DESKTOP_QUERY = "(min-width: 1024px) and (hover: hover) and (pointer: fine)";
function subscribeDesktop(onChange: () => void) {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Until a choice is saved, preserve the desktop auto-hide / mobile always-visible defaults. */
export function useNavbarAutoHideEnabled(mode?: NavbarMode) {
  const desktop = useSyncExternalStore(subscribeDesktop, () => window.matchMedia(DESKTOP_QUERY).matches, () => false);
  return mode ? mode === "auto-hide" : desktop;
}

export function useAutoHide<T extends HTMLElement>(enabled = true, interactionOpen = false, mode?: NavbarMode) {
  const autoHide = useNavbarAutoHideEnabled(mode);
  const active = enabled && autoHide;
  const ref = useRef<T>(null), revealRef = useRef<() => void>(() => {});
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || !active) return;
    const media = matchMedia("(hover: hover)");
    let timer: ReturnType<typeof setTimeout> | undefined, focusFrame: number | undefined;
    let hovered = false, topZone = false, lastY = window.scrollY, disposed = false;
    function clear() { if (timer !== undefined) clearTimeout(timer); timer = undefined; }
    function held() {
      return interactionOpen || (media.matches && (hovered || topZone)) || node!.contains(document.activeElement)
        || !!node!.querySelector("[data-popup-open], [aria-expanded='true']");
    }
    function arm() {
      clear();
      if (disposed || held()) return;
      timer = setTimeout(() => { timer = undefined; if (!disposed && !held()) setHidden(true); }, NAVBAR_IDLE_MS);
    }
    function show() { if (disposed) return; setHidden(false); arm(); }
    revealRef.current = show;
    function pointer(event: PointerEvent) {
      if (!media.matches || event.pointerType === "touch") return;
      // The reveal strip belongs to the navbar, not the scrollbar at the page edge.
      const bounds = node!.getBoundingClientRect();
      const next = event.clientY <= TOP_ZONE_PX && event.clientX >= bounds.left && event.clientX <= bounds.right;
      if (next !== topZone) { topZone = next; if (next) show(); else arm(); }
    }
    function enter(event: PointerEvent) { if (media.matches && event.pointerType !== "touch") { hovered = true; show(); } }
    function leave(event: PointerEvent) { if (event.pointerType !== "touch") { hovered = false; arm(); } }
    function focusIn() { show(); }
    function focusOut() {
      if (focusFrame !== undefined) cancelAnimationFrame(focusFrame);
      focusFrame = requestAnimationFrame(() => { focusFrame = undefined; arm(); });
    }
    function scroll() {
      const y = window.scrollY, delta = y - lastY; lastY = y;
      if (delta > 0 && y > SCROLL_HIDE_DELTA && !held()) { clear(); setHidden(true); }
      // Touch users can reveal by scrolling up, in addition to the persistent top handle.
      else if (delta < -2 && !media.matches) show();
      else if (delta > 0) arm();
    }
    function keyboard(event: KeyboardEvent) { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") show(); }
    function changed() { if (held()) show(); else arm(); }
    function inputModeChanged() { hovered = false; topZone = false; changed(); }
    const observer = new MutationObserver(changed);
    observer.observe(node, { attributes: true, subtree: true, attributeFilter: ["aria-expanded", "data-popup-open"] });
    window.addEventListener("pointermove", pointer); window.addEventListener("scroll", scroll, { passive: true }); window.addEventListener("keydown", keyboard);
    node.addEventListener("pointerenter", enter); node.addEventListener("pointerleave", leave); node.addEventListener("focusin", focusIn); node.addEventListener("focusout", focusOut);
    media.addEventListener("change", inputModeChanged);
    const startFrame = requestAnimationFrame(show);
    return () => {
      disposed = true; clear(); cancelAnimationFrame(startFrame); if (focusFrame !== undefined) cancelAnimationFrame(focusFrame); observer.disconnect(); revealRef.current = () => {};
      window.removeEventListener("pointermove", pointer); window.removeEventListener("scroll", scroll); window.removeEventListener("keydown", keyboard);
      node.removeEventListener("pointerenter", enter); node.removeEventListener("pointerleave", leave); node.removeEventListener("focusin", focusIn); node.removeEventListener("focusout", focusOut);
      media.removeEventListener("change", inputModeChanged);
    };
  }, [active, interactionOpen]);
  return { ref, hidden: active && !interactionOpen && hidden, reveal: () => revealRef.current() };
}

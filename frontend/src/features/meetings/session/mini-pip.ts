"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/** The Document Picture-in-Picture API (Chromium, secure pages): a small always-on-top window that can hold ordinary page content. */
type PipApi = { requestWindow: (options?: { width?: number; height?: number }) => Promise<Window> };
const api = (): PipApi | undefined => typeof window === "undefined" ? undefined : (window as unknown as { documentPictureInPicture?: PipApi }).documentPictureInPicture;

const never = () => () => {};
/** Whether this browser can open the separate call window; false on the server and in every browser that lacks the API. */
export function useDocumentPipSupported() {
  return useSyncExternalStore(never, () => Boolean(api()) && window.isSecureContext, () => false);
}

/**
 * Gives the new window the page's look: the same style rules (as adopted style sheets, which the strict Content-Security-Policy does not
 * restrict the way copied inline `<style>` tags would be), the same theme classes and language, kept in step while the window lives.
 * Returns what stops the syncing.
 */
function dressWindow(target: Window): () => void {
  try {
    const Sheet = (target as unknown as { CSSStyleSheet: typeof CSSStyleSheet }).CSSStyleSheet;
    const sheets: CSSStyleSheet[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
      try { const copy = new Sheet(); copy.replaceSync(Array.from(sheet.cssRules, rule => rule.cssText).join("\n")); sheets.push(copy); }
      catch { /* a sheet the page cannot read is simply left out */ }
    }
    target.document.adoptedStyleSheets = sheets;
  } catch { /* without styles the controls are still usable, just plain */ }
  const sync = () => {
    const html = target.document.documentElement, source = document.documentElement;
    html.className = source.className; html.lang = source.lang;
    for (const name of ["data-theme", "dir"]) { const value = source.getAttribute(name); if (value === null) html.removeAttribute(name); else html.setAttribute(name, value); }
    target.document.body.className = document.body.className;
  };
  sync();
  const observer = new MutationObserver(sync);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme", "lang", "dir"] });
  return () => observer.disconnect();
}

/**
 * Whether this window can really go full screen. Chromium does not offer the Fullscreen API inside a Picture-in-Picture window
 * (`fullscreenEnabled` is false there); where a browser does, it is used. Otherwise the window is made as large as the screen allows.
 */
export const canFullscreen = (target: Window) => Boolean(target.document.fullscreenEnabled && target.document.documentElement.requestFullscreen);

/** The one separate call window of this page: open it from a tap, close it, and know whether it is open (also when the person closes it). */
export function useDocumentPip() {
  const [window_, setWindow] = useState<Window | null>(null);
  // "Expanded": full screen (when the browser has it) or enlarged to the screen; `restore` remembers where and how big the window was.
  const [expanded, setExpanded] = useState(false);
  const restore = useRef<{ width: number; height: number; x: number; y: number } | null>(null);
  const current = useRef<{ window: Window; stop: () => void } | null>(null);
  const close = useCallback(() => {
    const open = current.current; current.current = null; setWindow(null); setExpanded(false); restore.current = null;
    if (!open) return;
    open.stop();
    try { open.window.close(); } catch { /* already closed */ }
  }, []);
  /** Full screen / back, or enlarge to the screen / back. Must run straight from a tap (the browser requires it). False when the browser refused. */
  const toggleExpanded = useCallback(async () => {
    const target = current.current?.window; if (!target) return false;
    try {
      if (canFullscreen(target)) {
        if (target.document.fullscreenElement) await target.document.exitFullscreen(); else await target.document.documentElement.requestFullscreen();
        return true;   // the state follows the browser's own fullscreenchange (it also covers leaving with Escape)
      }
      if (restore.current) {
        const before = restore.current; restore.current = null;
        target.resizeTo(before.width, before.height); target.moveTo(before.x, before.y); setExpanded(false);
      } else {
        restore.current = { width: target.outerWidth, height: target.outerHeight, x: target.screenX, y: target.screenY };
        const screen = target.screen as Screen & { availLeft?: number; availTop?: number };
        target.resizeTo(screen.availWidth, screen.availHeight); target.moveTo(screen.availLeft ?? 0, screen.availTop ?? 0); setExpanded(true);
      }
      return true;
    } catch { restore.current = null; return false; }
  }, []);
  /** Must run straight from a tap or key press (the browser requires it); rejects when the browser refuses. */
  const open = useCallback(async (title: string, size = { width: 360, height: 280 }) => {
    const existing = () => current.current?.window ?? null;
    if (existing()) return existing()!;
    const pip = api(); if (!pip) throw new Error("Document Picture-in-Picture is not available");
    const target = await pip.requestWindow(size);
    if (existing()) { target.close(); return existing()!; }
    target.document.title = title;
    const stop = dressWindow(target);
    current.current = { window: target, stop };
    target.document.addEventListener("fullscreenchange", () => { if (current.current?.window === target) setExpanded(Boolean(target.document.fullscreenElement)); });
    target.addEventListener("pagehide", () => { if (current.current?.window === target) { current.current.stop(); current.current = null; setWindow(null); } });
    setWindow(target);
    return target;
  }, []);
  useEffect(() => close, [close]);
  return { window: window_, open, close, expanded, toggleExpanded };
}

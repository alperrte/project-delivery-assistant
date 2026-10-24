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
 * (`fullscreenEnabled` is false there, and its size is capped by the browser); an ordinary window does.
 */
export const canFullscreen = (target: Window) => Boolean(target.document.fullscreenEnabled && target.document.documentElement.requestFullscreen);

const POPUP_NAME = "pda-call-window";
export type CallWindowKind = "pip" | "popup";

/**
 * The one separate call window of this page. It starts as a small always-on-top Picture-in-Picture window; for full screen the call moves
 * into an ordinary window the size of the screen (a Picture-in-Picture window cannot be made that large nor go full screen), which can then
 * use the browser's real full screen. Both show the same call from this page, which keeps the one LiveKit session.
 */
export function useDocumentPip() {
  const [window_, setWindow] = useState<Window | null>(null);
  const [kind, setKind] = useState<CallWindowKind>("pip");
  const [fullscreen, setFullscreen] = useState(false);
  const current = useRef<{ window: Window; stop: () => void; kind: CallWindowKind } | null>(null);
  const close = useCallback(() => {
    const open = current.current; current.current = null; setWindow(null); setFullscreen(false); setKind("pip");
    if (!open) return;
    open.stop();
    try { open.window.close(); } catch { /* already closed */ }
  }, []);
  /** Makes `target` the call window: styled like the page, following its theme, and forgotten again when the person closes it. */
  const adopt = useCallback((target: Window, windowKind: CallWindowKind, title: string) => {
    target.document.title = title;
    const stop = dressWindow(target);
    current.current = { window: target, stop, kind: windowKind };
    target.document.addEventListener("fullscreenchange", () => { if (current.current?.window === target) setFullscreen(Boolean(target.document.fullscreenElement)); });
    target.addEventListener("pagehide", () => { if (current.current?.window === target) { current.current.stop(); current.current = null; setWindow(null); setFullscreen(false); setKind("pip"); } });
    setWindow(target); setKind(windowKind); setFullscreen(false);
  }, []);
  /**
   * Full screen. Where the window can do it (an ordinary window), the browser's real full screen is toggled and the state follows its own
   * `fullscreenchange` (Escape included). From the Picture-in-Picture window the call moves into a screen-sized window instead. Must run
   * straight from a tap (the browser requires it); false when the browser refused (for example a pop-up blocker).
   */
  const toggleFullscreen = useCallback(async (title: string) => {
    const open = current.current; if (!open) return false;
    const target = open.window;
    try {
      if (canFullscreen(target)) {
        if (target.document.fullscreenElement) await target.document.exitFullscreen(); else await target.document.documentElement.requestFullscreen();
        return true;
      }
      if (open.kind !== "pip") return false;
      const area = target.screen as Screen & { availLeft?: number; availTop?: number };
      // Opened from the Picture-in-Picture window itself: that is the window the tap happened in, so the browser lets the pop-up open.
      const popup = target.open("", POPUP_NAME, `popup=yes,width=${area.availWidth},height=${area.availHeight},left=${area.availLeft ?? 0},top=${area.availTop ?? 0}`);
      if (!popup) return false;
      adopt(popup, "popup", title);
      open.stop(); try { open.window.close(); } catch { /* already closed */ }
      // Best effort: where the browser lets the new window use the tap too, it goes full screen at once; otherwise its own button does it.
      void popup.document.documentElement.requestFullscreen?.().catch(() => {});
      return true;
    } catch { return false; }
  }, [adopt]);
  /** Must run straight from a tap or key press (the browser requires it); rejects when the browser refuses. */
  const open = useCallback(async (title: string, size = { width: 360, height: 280 }) => {
    const existing = () => current.current?.window ?? null;
    if (existing()) return existing()!;
    const pip = api(); if (!pip) throw new Error("Document Picture-in-Picture is not available");
    const target = await pip.requestWindow(size);
    if (existing()) { target.close(); return existing()!; }
    adopt(target, "pip", title);
    return target;
  }, [adopt]);
  // The window belongs to this page: it goes with it (a Picture-in-Picture window does so by itself, an ordinary one does not).
  useEffect(() => { window.addEventListener("pagehide", close); return () => { window.removeEventListener("pagehide", close); close(); }; }, [close]);
  return { window: window_, kind, open, close, fullscreen, toggleFullscreen };
}

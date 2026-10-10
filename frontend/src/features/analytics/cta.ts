import { ADMIN_ENTRY_PATH } from "@/i18n/routing";
import { currentRoute, sendAnalyticsEvent, type ClientErrorKind, type CtaId } from "./transport";

export type { ClientErrorKind, CtaId };

const measured = () => typeof window !== "undefined" && window.location.pathname.replace(/\/+$/, "") !== ADMIN_ENTRY_PATH;

/**
 * Records that a call-to-action from the fixed list was used. Only the id and the page type are sent, never text or a
 * person; nothing happens without analytics consent (the transport decides again right before sending). `keepalive`
 * lets the request survive the navigation a link click causes.
 */
export function trackCta(id: CtaId) {
  if (!measured()) return;
  void sendAnalyticsEvent({ type: "CTA_CLICK", path: currentRoute(), ctaId: id }, { keepalive: true });
}

/**
 * Reports that something failed, by kind only: no message, stack, address or identifier ever leaves the browser. The
 * transport drops repeats of the same kind on the same route within a session and caps the total.
 */
export function reportClientError(kind: ClientErrorKind) {
  if (!measured()) return;
  void sendAnalyticsEvent({ type: "CLIENT_ERROR", path: currentRoute(), errorKind: kind }, { keepalive: true });
}

/** Classifies a render error for `reportClientError`. The message is only inspected here, never sent. */
export function renderErrorKind(error: unknown): ClientErrorKind {
  return isChunkLoadError(error) ? "chunk_load" : "render";
}

export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === "ChunkLoadError"
    || /Loading (CSS )?chunk [\w-]+ failed|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(error.message);
}

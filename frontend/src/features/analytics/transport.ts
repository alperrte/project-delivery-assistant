import { apiRequest } from "@/lib/api/client";
import { CONSENT_VERSION, analyticsAllowed } from "@/features/consent/contract";
import { ensureIdentity } from "./identifiers";
import { routeTemplate } from "./route";

export type CtaId =
  | "landing_register" | "landing_login" | "header_register" | "header_login"
  | "register_submit" | "contact_submit" | "github_repo";
export type ClientErrorKind = "render" | "chunk_load" | "unhandled_rejection" | "network";

export type AnalyticsEvent =
  | { type: "PAGE_VIEW"; path: string; referrerHost?: string; utmSource?: string; utmMedium?: string; utmCampaign?: string }
  | { type: "ENGAGEMENT"; path: string; engagedSeconds: number }
  | { type: "CTA_CLICK"; path: string; ctaId: CtaId }
  | { type: "CLIENT_ERROR"; path: string; errorKind: ClientErrorKind };

// One request at a time, in order: the server opens a session on the first PAGE_VIEW and every other event needs it to exist.
let queue: Promise<unknown> = Promise.resolve();

/** The analytics session the server is known to have (a PAGE_VIEW was accepted for it) and the page that opened it. */
let openSession: string | null = null;
/** A page view this module sent only to open a session; the tracker's own view of the same page right after it is not sent twice. */
let bridged: { sessionId: string; path: string } | null = null;

/** Errors already reported (per session, route and kind) and how many were sent, so a failing page cannot flood the endpoint. */
const reportedErrors = new Set<string>();
const MAX_ERROR_REPORTS = 20;

async function post(body: Record<string, unknown>, keepalive?: boolean): Promise<boolean> {
  try {
    await apiRequest("/analytics/events", { method: "POST", body, keepalive, guard: analyticsAllowed });
    return true;
  } catch {
    // Measurement must never disturb the application: a failed event is simply lost.
    return false;
  }
}

/**
 * THE single place analytics leaves the browser. Every send re-reads the stored decision: with analytics off (never
 * decided, rejected, withdrawn, or an older consent version) nothing is created and nothing is sent. The same check
 * runs once more right before the request goes out, so a withdrawal that happens while a request is being prepared
 * still stops it. Returns whether a request was made.
 *
 * Button clicks and error reports only make sense inside a session the server already knows. They are queued behind
 * the page view that opened it; when no page view has reached the server for the current session yet (an error before
 * the first view, a session renewed after a long idle period), the page being viewed is announced first.
 */
export function sendAnalyticsEvent(event: AnalyticsEvent, options: { keepalive?: boolean } = {}): Promise<boolean> {
  if (!analyticsAllowed()) return Promise.resolve(false);
  const result = queue.then(async () => {
    const identity = ensureIdentity();
    if (!identity) return false;
    const base = { ...identity, consentVersion: CONSENT_VERSION };

    if (event.type === "CLIENT_ERROR") {
      const key = `${identity.sessionId}|${event.path}|${event.errorKind}`;
      if (reportedErrors.has(key) || reportedErrors.size >= MAX_ERROR_REPORTS) return false;
      reportedErrors.add(key);
    }

    if (event.type === "PAGE_VIEW") {
      if (bridged?.sessionId === identity.sessionId && bridged.path === event.path) {
        bridged = null;
        return false;
      }
      bridged = null;
      const sent = await post({ ...event, ...base }, options.keepalive);
      if (sent) openSession = identity.sessionId;
      return sent;
    }

    if (event.type !== "ENGAGEMENT" && openSession !== identity.sessionId) {
      const opened = await post({ type: "PAGE_VIEW", path: event.path, ...base }, options.keepalive);
      if (!opened) return false;
      openSession = identity.sessionId;
      bridged = { sessionId: identity.sessionId, path: event.path };
    }
    return post({ ...event, ...base }, options.keepalive);
  });
  queue = result;
  return result;
}

/** The route template of the page being viewed right now. */
export function currentRoute(): string {
  return routeTemplate(window.location.pathname);
}

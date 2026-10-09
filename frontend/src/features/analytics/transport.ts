import { apiRequest } from "@/lib/api/client";
import { CONSENT_VERSION, analyticsAllowed } from "@/features/consent/contract";
import { ensureIdentity } from "./identifiers";

export type AnalyticsEvent =
  | { type: "PAGE_VIEW"; path: string; referrerHost?: string; utmSource?: string; utmMedium?: string; utmCampaign?: string }
  | { type: "ENGAGEMENT"; path: string; engagedSeconds: number };

// One request at a time, in order: the server opens a session on the first PAGE_VIEW and ENGAGEMENT needs it to exist.
let queue: Promise<unknown> = Promise.resolve();

/**
 * THE single place analytics leaves the browser. Every send re-reads the stored decision: with analytics off (never
 * decided, rejected, withdrawn, or an older consent version) nothing is created and nothing is sent. The same check
 * runs once more right before the request goes out, so a withdrawal that happens while a request is being prepared
 * still stops it. Returns whether a request was made.
 */
export function sendAnalyticsEvent(event: AnalyticsEvent, options: { keepalive?: boolean } = {}): Promise<boolean> {
  if (!analyticsAllowed()) return Promise.resolve(false);
  const result = queue.then(async () => {
    const identity = ensureIdentity();
    if (!identity) return false;
    const body = { ...event, ...identity, consentVersion: CONSENT_VERSION };
    try {
      await apiRequest("/analytics/events", { method: "POST", body, keepalive: options.keepalive, guard: analyticsAllowed });
      return true;
    } catch {
      // Measurement must never disturb the application: a failed event is simply lost.
      return false;
    }
  });
  queue = result;
  return result;
}

"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { ADMIN_ENTRY_PATH } from "@/i18n/routing";
import { purgeAnalyticsStorage } from "@/features/consent/contract";
import { useConsent } from "@/features/consent/consent-store";
import { forgetIdentity } from "./identifiers";
import { readLanding, routeTemplate, type Landing } from "./route";
import { sendAnalyticsEvent } from "./transport";

/** Foreground time is reported about this often while the page is visible and focused. */
export const HEARTBEAT_MS = 15_000;
const MAX_REPORT_SECONDS = 600;

// Read once, when the page was loaded, and only held in memory. The first page view takes it; later ones carry none.
let landing: Landing | null = typeof window === "undefined" ? null : readLanding();

function takeLanding(): Landing {
  const taken = landing ?? {};
  landing = null;
  return taken;
}

/**
 * Counts only time the person can actually see the page: visible tab AND focused window. Background tabs and
 * windows behind others add nothing. Time is flushed on every visible/focus change, on the heartbeat and when the
 * page is hidden or closed (approximate by nature: a crash loses the last interval).
 */
function startEngagement(currentRoute: () => string) {
  let activeSince: number | null = null;
  let pendingMs = 0;
  const isActive = () => document.visibilityState === "visible" && document.hasFocus();

  const settle = (now: number) => {
    if (activeSince !== null) {
      pendingMs += now - activeSince;
      activeSince = now;
    }
  };
  const flush = (keepalive: boolean) => {
    const seconds = Math.min(Math.floor(pendingMs / 1000), MAX_REPORT_SECONDS);
    if (seconds < 1) return;
    pendingMs -= seconds * 1000;
    void sendAnalyticsEvent({ type: "ENGAGEMENT", path: currentRoute(), engagedSeconds: seconds }, { keepalive });
  };
  const sync = () => {
    const now = performance.now();
    if (isActive()) {
      activeSince ??= now;
    } else {
      settle(now);
      activeSince = null;
      flush(false);
    }
  };
  const leave = () => {
    settle(performance.now());
    activeSince = null;
    flush(true);
  };

  const timer = window.setInterval(() => {
    settle(performance.now());
    flush(false);
  }, HEARTBEAT_MS);
  document.addEventListener("visibilitychange", sync);
  window.addEventListener("focus", sync);
  window.addEventListener("blur", sync);
  window.addEventListener("pagehide", leave);
  sync();

  return () => {
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", sync);
    window.removeEventListener("focus", sync);
    window.removeEventListener("blur", sync);
    window.removeEventListener("pagehide", leave);
  };
}

/**
 * Mounted once for the whole application. While analytics is not allowed it does nothing at all: no listener, no
 * timer, no identifier, no request. The decision itself is re-read by the transport before every request.
 */
export function AnalyticsTracker() {
  const consent = useConsent();
  const pathname = usePathname() ?? "/";
  const route = routeTemplate(pathname);
  // The administrator sign-in is not a measured page (it would only show up as an unknown address).
  const allowed = consent.ready && consent.analytics && pathname !== ADMIN_ENTRY_PATH;
  const routeRef = useRef(route);

  useEffect(() => {
    routeRef.current = route;
  }, [route]);

  // Nothing analytics-owned may outlive a "no": clear what an earlier decision (or an older consent version) left.
  useEffect(() => {
    if (consent.ready && !consent.analytics) {
      purgeAnalyticsStorage();
      forgetIdentity();
    }
  }, [consent.ready, consent.analytics]);

  // One page view per route change (and one when analytics is switched on for the page being viewed).
  useEffect(() => {
    if (!allowed) return;
    void sendAnalyticsEvent({ type: "PAGE_VIEW", path: route, ...takeLanding() });
  }, [allowed, route]);

  useEffect(() => {
    if (!allowed) return;
    return startEngagement(() => routeRef.current);
  }, [allowed]);

  return null;
}

"use client";

import { useReportWebVitals } from "next/web-vitals";

/**
 * Development aid: prints every Core Web Vital (LCP, CLS, INP, FCP, TTFB) of the page to the browser console as it is measured.
 * Mounted from the root layout only when `NODE_ENV !== "production"`, so it adds nothing to a production bundle and sends
 * nothing anywhere. Production reporting needs a consent-gated backend event type (see .agents/architecture.md, "Core Web Vitals").
 */
export function WebVitalsDebug() {
  useReportWebVitals(metric => {
    const value = metric.name === "CLS" ? metric.value.toFixed(3) : `${Math.round(metric.value)} ms`;
    console.debug(`[web-vitals] ${metric.name} ${value} (${metric.rating ?? "n/a"})`);
  });
  return null;
}

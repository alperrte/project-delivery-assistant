"use client";

import { useEffect } from "react";

/**
 * Registers the offline-page service worker (`public/sw.js`) in production builds. In development it removes any worker an
 * earlier production run left on this origin, so a stale cache can never hide a hot-reloaded page. Renders nothing.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.getRegistrations().then((registrations) => registrations.forEach((registration) => void registration.unregister()));
      return;
    }
    // A failed registration only means no offline page; the site itself is unaffected.
    void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => undefined);
  }, []);
  return null;
}

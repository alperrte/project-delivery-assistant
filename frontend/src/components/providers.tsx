"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { MotionConfig } from "motion/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeTransitionOverlay } from "@/components/layout/theme-transition";
import { queryRetryDelay, shouldRetryQuery } from "@/lib/api/query-retry";
import { applyMotionPreference, useMotionPreference, useReducedMotionPreference } from "@/lib/preferences/motion";
import { ConsentProvider } from "@/features/consent/consent-provider";
import { AnalyticsTracker } from "@/features/analytics/tracker";

/**
 * next-themes injects its no-FOUC script via React.createElement("script", ...),
 * which still runs correctly through the SSR HTML but triggers a React 19
 * false-positive dev warning. No upstream fix exists (library unmaintained
 * since March 2025): https://github.com/pacocoursey/next-themes/issues/397
 * The warning only exists in development, so the patch is not installed in production builds.
 */
if (process.env.NODE_ENV !== "production" && typeof window !== "undefined" && !("__themeScriptWarningPatched" in window)) {
  Object.assign(window, { __themeScriptWarningPatched: true });
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].includes("Encountered a script tag")) {
      return;
    }
    originalError(...args);
  };
}

/**
 * Applies the user's motion choice everywhere: the stylesheet reads `<html data-motion>` (CSS animations and
 * transitions), and `MotionConfig` tells every `motion` component to skip transforms when it is off.
 */
function MotionPreference({ children }: { children: ReactNode }) {
  const [preference] = useMotionPreference();
  const reduce = useReducedMotionPreference();
  useEffect(() => applyMotionPreference(preference), [preference]);
  return (
    <MotionConfig reducedMotion={reduce ? "always" : "never"}>
      {children}
    </MotionConfig>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          // Reads retry twice on network errors / 502 / 503 / 504 with back-off; 4xx never (src/lib/api/query-retry.ts).
          queries: { retry: shouldRetryQuery, retryDelay: queryRetryDelay, refetchOnWindowFocus: false, staleTime: 30_000 },
          // Without this a save sent while the browser is offline is paused, not failed: the button stays disabled with no
          // message and the request fires by itself when the connection returns. Failing right away shows the network error.
          // Mutations are never retried: a repeated POST could run twice.
          mutations: { networkMode: "always", retry: false },
        },
      }),
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <MotionPreference>
          <TooltipProvider delay={150}><ConsentProvider>{children}</ConsentProvider><AnalyticsTracker /></TooltipProvider>
          <Toaster position="top-center" />
          <ThemeTransitionOverlay />
        </MotionPreference>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

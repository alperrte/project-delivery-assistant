"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { MotionConfig } from "motion/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeTransitionOverlay } from "@/components/layout/theme-transition";
import { applyMotionPreference, useMotionPreference } from "@/lib/preferences/motion";

/**
 * next-themes injects its no-FOUC script via React.createElement("script", ...),
 * which still runs correctly through the SSR HTML but triggers a React 19
 * false-positive dev warning. No upstream fix exists (library unmaintained
 * since March 2025): https://github.com/pacocoursey/next-themes/issues/397
 */
if (typeof window !== "undefined" && !("__themeScriptWarningPatched" in window)) {
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
  useEffect(() => applyMotionPreference(preference), [preference]);
  return (
    <MotionConfig reducedMotion={preference === "off" ? "always" : preference === "on" ? "never" : "user"}>
      {children}
    </MotionConfig>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, refetchOnWindowFocus: false, staleTime: 30_000 },
        },
      }),
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <MotionPreference>
          <TooltipProvider delay={150}>{children}</TooltipProvider>
          <Toaster position="top-center" />
          <ThemeTransitionOverlay />
        </MotionPreference>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

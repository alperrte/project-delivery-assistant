"use client";

import { useState, type ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeTransitionOverlay } from "@/components/layout/theme-transition";

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
        <TooltipProvider delay={150}>{children}</TooltipProvider>
        <Toaster position="top-center" />
        <ThemeTransitionOverlay />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

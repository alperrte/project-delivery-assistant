"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { resolveDemoQuery, type DemoData } from "./demo-data";

/** A separate client for the public illustration. Production API clients and session caches are never changed. */
export function LandingPdaDemoProvider({ data, children }: { data: DemoData; children: ReactNode }) {
  const [client] = useState(() => {
    const preview = new QueryClient();
    const queryDefaults = preview.defaultQueryOptions.bind(preview);
    preview.defaultQueryOptions = options => queryDefaults({
      ...options,
      initialData: resolveDemoQuery(options.queryKey ?? [], data) as never,
      queryFn: () => { throw new Error("PDA illustration cannot request backend data"); },
      enabled: false,
      staleTime: Infinity,
      retry: false,
      refetchInterval: false,
    });
    const mutationDefaults = preview.defaultMutationOptions.bind(preview);
    preview.defaultMutationOptions = options => ({ ...mutationDefaults(options),
      ...options,
      mutationFn: async () => { throw new Error("PDA illustration is read only"); },
      retry: false,
    });
    return preview;
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

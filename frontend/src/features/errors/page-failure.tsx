"use client";

import { ApiError } from "@/lib/api/client";
import { ErrorScreen } from "./error-screen";
import type { ErrorCode } from "./types";

/** Only page-level queries use this; validation/mutation errors remain next to their action. */
export function PageFailure({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  let code: ErrorCode = "500";
  if (error instanceof ApiError) {
    // Session expiration is already handled by AppShell and the API client.
    if (error.status === 401) return null;
    if (error.status === 403) code = "403";
    else if (error.status === 404) code = "404";
    else if ([0, 502, 503, 504].includes(error.status)) code = "503";
  }
  return <ErrorScreen code={code} embedded onRetry={onRetry} />;
}

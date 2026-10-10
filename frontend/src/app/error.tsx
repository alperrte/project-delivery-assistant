"use client";

import { useEffect } from "react";
import { renderErrorKind, reportClientError } from "@/features/analytics/cta";
import { ErrorScreen } from "@/features/errors/error-screen";
import { useErrorTitle } from "@/features/errors/use-error-title";

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useErrorTitle("500");
  // Kind only (render or chunk load): the message and stack never leave the browser, and nothing is sent without analytics consent.
  useEffect(() => { reportClientError(renderErrorKind(error)); }, [error]);
  return <ErrorScreen code="500" onRetry={retry} />;
}

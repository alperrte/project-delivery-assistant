"use client";

import { useEffect } from "react";
import { renderErrorKind, reportClientError } from "@/features/analytics/cta";
import { ErrorScreen } from "@/features/errors/error-screen";
import { useErrorTitle } from "@/features/errors/use-error-title";

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useErrorTitle("500");
  useEffect(() => { reportClientError(renderErrorKind(error)); }, [error]);
  return <ErrorScreen code="500" embedded onRetry={retry} />;
}

"use client";

import { ErrorScreen } from "@/features/errors/error-screen";
import { useErrorTitle } from "@/features/errors/use-error-title";

export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useErrorTitle("500");
  return <ErrorScreen code="500" onRetry={retry} />;
}

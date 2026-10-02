"use client";

import { ErrorScreen } from "@/features/errors/error-screen";

export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorScreen code="500" onRetry={retry} />;
}

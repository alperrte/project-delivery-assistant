"use client";

import { ErrorScreen } from "@/features/errors/error-screen";

export default function AppError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorScreen code="500" embedded onRetry={retry} />;
}

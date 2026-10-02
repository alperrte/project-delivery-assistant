"use client";

import { useMessages } from "next-intl";
import { ErrorContent } from "./error-content";
import type { ErrorCode, ErrorCopy } from "./types";
import { ErrorFrame } from "./error-frame";

export function ErrorScreen({ code, onRetry, embedded = false }: { code: ErrorCode; onRetry?: () => void; embedded?: boolean }) {
  const copy = useMessages().errorPages as unknown as ErrorCopy;
  const content = <ErrorContent code={code} copy={copy} onRetry={onRetry} />;
  return embedded ? content : <ErrorFrame>{content}</ErrorFrame>;
}

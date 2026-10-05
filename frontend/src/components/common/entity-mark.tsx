/* eslint-disable @next/next/no-img-element -- authenticated media cannot be proxied by next/image. */
"use client";

import { useState } from "react";
import { useLocale } from "next-intl";

/** Logo tile content: the uploaded logo, or the first letter when there is none (or it failed to load). */
export function EntityMark({ name, src }: { name: string; src: string | null }) {
  const locale = useLocale();
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (src && failedSrc !== src) {
    return <img src={src} alt="" className="size-full rounded-[inherit] object-cover" onError={() => setFailedSrc(src)} />;
  }
  return <>{(name.trim().slice(0, 1) || "?").toLocaleUpperCase(locale)}</>;
}

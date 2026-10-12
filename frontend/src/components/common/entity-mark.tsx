/* eslint-disable @next/next/no-img-element -- authenticated media cannot be proxied by next/image. */
"use client";

import { useState } from "react";
import type { LogoShape } from "@/lib/media/logo-shape";
import { useLocale } from "next-intl";

/** Logo tile content: the uploaded logo, or the first letter when there is none (or it failed to load). */
export function EntityMark({ name, src, shape = "SQUARE" }: { name: string; src: string | null; shape?: LogoShape }) {
  const locale = useLocale();
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  return <span data-logo-shape={shape} className="grid size-full place-items-center overflow-hidden rounded-[inherit]">{src && failedSrc !== src ? <img src={src} alt="" loading="lazy" decoding="async" className="size-full rounded-[inherit] object-cover" onError={() => setFailedSrc(src)} /> : (name.trim().slice(0, 1) || "?").toLocaleUpperCase(locale)}</span>;
}

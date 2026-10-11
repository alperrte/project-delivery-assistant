/* eslint-disable @next/next/no-img-element -- the entity cover is an authenticated API image; next/image optimisation does not apply. */
"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The decorative cover image of a project. Without one, or when it fails to load, a quiet dotted surface takes its
 * place, so the layout never shifts and every project page, card and preview keeps the same proportions.
 */
export function EntityCover({ src, className, fallback }: { src: string | null; className?: string; fallback?: ReactNode }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = src !== null && failedSrc !== src;
  return (
    <div aria-hidden="true" className={cn("relative aspect-[3/1] w-full overflow-hidden bg-muted sm:aspect-[4/1]", className)}>
      {showImage ? (
        <img src={src} alt="" loading="lazy" decoding="async" className="size-full object-cover" onError={() => setFailedSrc(src)} />
      ) : (
        fallback ?? <div className="size-full bg-[radial-gradient(circle,var(--border)_1px,transparent_1px)] bg-[length:14px_14px]" />
      )}
    </div>
  );
}

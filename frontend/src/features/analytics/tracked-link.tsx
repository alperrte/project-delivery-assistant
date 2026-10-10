"use client";

import type { ComponentProps } from "react";
import Link from "@/i18n/navigation";
import { trackCta, type CtaId } from "./cta";

/** A link that reports its click as a call-to-action from the fixed list (only with analytics consent). Looks and works like `Link`. */
export function TrackedLink({ ctaId, onClick, ...props }: ComponentProps<typeof Link> & { ctaId: CtaId }) {
  return <Link {...props} onClick={(event) => { trackCta(ctaId); onClick?.(event); }} />;
}

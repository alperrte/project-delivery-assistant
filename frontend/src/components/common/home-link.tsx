"use client";

import type { ComponentProps, MouseEvent } from "react";
import Link from "@/i18n/navigation";
import { useReducedMotionPreference } from "@/lib/preferences/motion";

let requestedAt: number | null = null;

/** Consume a recent return request once; abandoned navigations do not animate later visits. */
export function consumeHomeReturn() {
  const recent = requestedAt !== null && Date.now() - requestedAt < 5000;
  requestedAt = null;
  return recent;
}

/** Keep Next's normal navigation; only the destination gets a short entrance animation. */
export function HomeLink({ onClick, ...props }: Omit<ComponentProps<typeof Link>, "href">) {
  const reduce = useReducedMotionPreference();

  function navigate(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey ||
      event.shiftKey || event.altKey || event.currentTarget.hasAttribute("download") ||
      (event.currentTarget.target && event.currentTarget.target !== "_self") ||
      reduce) return;
    requestedAt = Date.now();
  }

  return <Link {...props} href="/" onClick={navigate} />;
}

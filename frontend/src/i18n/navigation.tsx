"use client";

import { useMemo, type ComponentProps } from "react";
import NextLink from "next/link";
import { usePathname as useNextPathname, useRouter as useNextRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { type Locale } from "./config";
import { localizeHref, matchPath } from "./routing";

export { useSearchParams } from "next/navigation";

/** One page-link boundary; API URLs and external links are left untouched. */
export default function Link({ href, ...props }: ComponentProps<typeof NextLink>) {
  const locale = useLocale() as Locale;
  return <NextLink href={typeof href === "string" ? localizeHref(href, locale) : href} {...props} />;
}

/** Existing components can keep working with logical App Router paths after the public URL is localized. */
export function usePathname() {
  const pathname = useNextPathname();
  return matchPath(pathname)?.internalPath ?? pathname;
}

export function useRouter() {
  const router = useNextRouter();
  const locale = useLocale() as Locale;
  return useMemo(() => ({
    ...router,
    push: (href: string, options?: Parameters<typeof router.push>[1]) => router.push(localizeHref(href, locale), options),
    replace: (href: string, options?: Parameters<typeof router.replace>[1]) => router.replace(localizeHref(href, locale), options),
    prefetch: (href: string, options?: Parameters<typeof router.prefetch>[1]) => router.prefetch(localizeHref(href, locale), options),
  }), [router, locale]);
}

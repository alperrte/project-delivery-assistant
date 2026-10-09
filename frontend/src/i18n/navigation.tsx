"use client";

import { useMemo, type ComponentProps } from "react";
import NextLink from "next/link";
import {
  ReadonlyURLSearchParams, usePathname as useNextPathname, useRouter as useNextRouter, useSearchParams as useNextSearchParams,
} from "next/navigation";
import { useLocale } from "next-intl";
import { type Locale } from "./config";
import { localizeHref, matchPath } from "./routing";

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

/** A project section's public URL has no `?section=`; the components that read it still get it, as before. */
export function useSearchParams() {
  const pathname = useNextPathname();
  const search = useNextSearchParams();
  return useMemo(() => {
    const section = matchPath(pathname)?.section;
    if (!section) return search;
    const params = new URLSearchParams(search.toString());
    params.set("section", section);
    return new ReadonlyURLSearchParams(params);
  }, [pathname, search]);
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

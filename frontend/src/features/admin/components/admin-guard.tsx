"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "@/i18n/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/features/auth/hooks/use-session";
import { ADMIN_ENTRY_PATH } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { PageContainer } from "@/components/common/page-container";
import { adminApi } from "../api";
import { adminKeys } from "../query-keys";

const ITEMS = [
  { key: "users", href: "/admin/users" },
  { key: "support", href: "/admin/support" },
  { key: "analytics", href: "/admin/analytics" },
  { key: "audit", href: "/admin/audit" },
  { key: "system", href: "/admin/system" },
] as const;
const COUNT_LIMIT = 99;

/**
 * Shows the administration area only to an administrator whose session was opened by the separate administrator
 * sign-in (`adminVerified`). An administrator without that mark (an older session) is sent to `/pd-admin` to sign in
 * again; anyone else goes to the dashboard. Both happen before any admin content is rendered. This is a convenience,
 * not security: the backend refuses every admin API call of a session without the mark (403
 * `admin_reauthentication_required`) and of a non-administrator (403).
 */
export function AdminArea({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const t = useTranslations("admin");
  const router = useRouter();
  const { data: user, isLoading } = useSession();
  const isAdmin = user?.globalRole === "ADMIN";
  const allowed = isAdmin && user?.adminVerified === true;
  // One cheap list call (a single row) read for its total: how many requests still wait for a first look.
  const waiting = useQuery({
    queryKey: adminKeys.supportNewCount(user?.id),
    queryFn: ({ signal }) => adminApi.supportRequests({ page: 0, size: 1, status: "NEW", category: "" }, signal),
    enabled: allowed,
    refetchInterval: 60_000,
    select: (page) => page.totalElements,
  });
  const newRequests = waiting.data ?? 0;
  // On a narrow screen the tab strip scrolls sideways: keep the current section in view.
  const strip = useRef<HTMLElement>(null);
  useEffect(() => {
    strip.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [pathname, allowed]);

  useEffect(() => {
    if (isLoading || allowed) return;
    router.replace(isAdmin ? `${ADMIN_ENTRY_PATH}?reason=reauthenticate` : "/dashboard");
  }, [isLoading, allowed, isAdmin, router]);

  if (!allowed) {
    return (
      <div role="status" aria-label={t("checking")} className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <PageContainer>
      <nav ref={strip} aria-label={t("nav.section")} className="mb-6 flex gap-1 overflow-x-auto border-b border-border">
        {ITEMS.map(({ key, href }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={key}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "-mb-px inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`nav.${key}`)}
              {key === "support" && newRequests > 0 && (
                <>
                  <span aria-hidden="true" data-testid="support-new-count" className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground tabular-nums">
                    {newRequests > COUNT_LIMIT ? `${COUNT_LIMIT}+` : newRequests}
                  </span>
                  <span className="sr-only">{t("nav.newRequests", { count: newRequests })}</span>
                </>
              )}
            </Link>
          );
        })}
      </nav>
      {children}
    </PageContainer>
  );
}

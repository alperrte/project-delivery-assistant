"use client";

import { useEffect, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import Link from "@/i18n/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/features/auth/hooks/use-session";
import { ADMIN_ENTRY_PATH } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { PageContainer } from "@/components/common/page-container";

const ITEMS = [{ key: "users", href: "/admin/users" }, { key: "analytics", href: "/admin/analytics" }] as const;

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
      <nav aria-label={t("nav.section")} className="mb-6 flex gap-1 border-b border-border">
        {ITEMS.map(({ key, href }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={key}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "-mb-px inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`nav.${key}`)}
            </Link>
          );
        })}
      </nav>
      {children}
    </PageContainer>
  );
}

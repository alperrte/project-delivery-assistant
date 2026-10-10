"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/features/auth/hooks/use-session";
import { adminLandingPath } from "../hooks/use-complete-admin-login";
import { AdminLoginFlow, type AdminLoginNotice } from "./admin-login-flow";

/**
 * The page behind `/pd-admin`. A visitor who already holds an administrator-verified session goes straight to the
 * panel; everyone else sees the sign-in, including a visitor with a regular session (a regular session never grants
 * admin access, so there is nothing to show them but the sign-in). `hasSessionHint` is the server's look at the
 * non-secret `PDA_SESSION` marker: without it there is no session to ask the API about.
 */
export function AdminLoginPage({ hasSessionHint, notice }: { hasSessionHint: boolean; notice: AdminLoginNotice | null }) {
  const t = useTranslations("adminLogin");
  const router = useRouter();
  const { data: user, isLoading } = useSession(hasSessionHint);
  const verified = user?.globalRole === "ADMIN" && user.adminVerified === true;

  useEffect(() => {
    if (verified) router.replace(adminLandingPath(window.location.search));
  }, [verified, router]);

  if (verified || (hasSessionHint && isLoading)) {
    return (
      <div role="status" aria-label={t("checking")} className="mx-auto w-full max-w-[30rem] space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-52 w-full rounded-[1.25rem]" />
      </div>
    );
  }

  return <AdminLoginFlow initialNotice={notice} />;
}

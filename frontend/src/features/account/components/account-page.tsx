"use client";

import { useTranslations } from "next-intl";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/features/auth/hooks/use-session";
import { ProfileSection } from "./profile-section";
import { SecuritySection } from "./security-section";

/** Who the person is and their password. Reached from the account menu in the navbar; the interface choices live on Settings. */
export function AccountPage() {
  const t = useTranslations("account");
  const { data: user } = useSession();

  return (
    <PageContainer width="form">
      <PageHeader title={t("title")} description={t("description")} />
      {!user ? (
        <Skeleton className="h-72 w-full rounded-2xl" />
      ) : (
        <>
          <ProfileSection user={user} />
          <SecuritySection />
        </>
      )}
    </PageContainer>
  );
}

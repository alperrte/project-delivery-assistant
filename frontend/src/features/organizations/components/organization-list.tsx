"use client";

import { useState } from "react";
import Link from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "@phosphor-icons/react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { EntityCardSkeleton, EntityGrid } from "@/components/common/entity-card";
import { PaginationBar } from "@/components/common/pagination-bar";
import { buttonVariants } from "@/components/ui/button";
import { errorKey } from "@/lib/api/error-message";
import { organizationKeys } from "../queries";
import { organizationsApi } from "../api";
import { OrganizationCard } from "./organization-card";

export function OrganizationList() {
  const t = useTranslations("organizations");
  const te = useTranslations("errors");
  const [page, setPage] = useState(0);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: organizationKeys.list(page),
    queryFn: () => organizationsApi.list(page),
  });

  return (
    <div>
      <PageHeader
        title={t("title")}
        description={t("description")}
        action={
          <Link href="/organizations/new" className={buttonVariants()}>
            <Plus data-icon="inline-start" size={16} aria-hidden="true" />
            {t("create")}
          </Link>
        }
      />

      {isLoading && (
        <EntityGrid>
          {Array.from({ length: 6 }, (_, key) => <li key={key} className="flex"><EntityCardSkeleton /></li>)}
        </EntityGrid>
      )}

      {isError && <p className="text-sm text-destructive">{te(errorKey(error))}</p>}

      {data && data.content.length === 0 && (
        <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />
      )}

      {data && data.content.length > 0 && (
        <>
          <EntityGrid>
            {data.content.map((org) => (
              <li key={org.id} className="flex">
                <OrganizationCard organization={org} />
              </li>
            ))}
          </EntityGrid>
          <PaginationBar
            page={data.page}
            totalPages={data.totalPages}
            totalElements={data.totalElements}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}

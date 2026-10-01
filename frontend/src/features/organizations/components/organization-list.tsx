"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { CalendarBlank, Plus } from "@phosphor-icons/react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { EntityCard, EntityCardFooter, EntityCardLink, EntityCardSection, EntityGrid, EntityStatusPill } from "@/components/common/entity-card";
import { PaginationBar } from "@/components/common/pagination-bar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { errorKey } from "@/lib/api/error-message";
import { organizationsApi } from "../api";
import { OrganizationFormDialog } from "./organization-form-dialog";

export function OrganizationList() {
  const t = useTranslations("organizations");
  const locale = useLocale();
  const te = useTranslations("errors");
  const [page, setPage] = useState(0);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["organizations", page],
    queryFn: () => organizationsApi.list(page),
  });
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  return (
    <div>
      <PageHeader
        title={t("title")}
        description={t("description")}
        action={
          <OrganizationFormDialog
            trigger={
              <Button>
                <Plus data-icon="inline-start" size={16} />
                {t("create")}
              </Button>
            }
          />
        }
      />

      {isLoading && (
        <EntityGrid>
          {[0, 1, 2].map((key) => <li key={key}><Skeleton className="h-72 w-full rounded-xl" /></li>)}
        </EntityGrid>
      )}

      {isError && <p className="text-sm text-destructive">{te(errorKey(error))}</p>}

      {data && data.content.length === 0 && (
        <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />
      )}

      {data && data.content.length > 0 && (
        <>
          <EntityGrid>
            {data.content.map((org) => {
              const active = org.status === "ACTIVE";
              return (
                <li key={org.id} className="flex">
                  <EntityCard
                    tone={active ? "success" : "neutral"}
                    mark={org.name.slice(0, 1).toLocaleUpperCase(locale)}
                    title={org.name}
                    description={org.description || t("cardNoDescription")}
                    badge={
                      <EntityStatusPill
                        className={active ? "border border-success/25 bg-success/10 text-success" : "border border-border bg-muted text-muted-foreground"}
                        dotClassName={active ? "bg-success" : "bg-muted-foreground/40"}
                        label={t(`statusValues.${org.status}`)}
                      />
                    }
                  >
                    <EntityCardSection label={t("card.lastUpdate")}>
                      <p className="flex items-center gap-2 text-sm text-foreground">
                        <CalendarBlank size={16} className="text-muted-foreground" aria-hidden="true" />
                        <time dateTime={org.updatedAt}>{date.format(new Date(org.updatedAt))}</time>
                      </p>
                    </EntityCardSection>
                    <EntityCardFooter>
                      <EntityCardLink href={`/organizations/${org.id}`} label={t("cardOpen")} ariaLabel={t("card.openNamed", { name: org.name })} />
                    </EntityCardFooter>
                  </EntityCard>
                </li>
              );
            })}
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

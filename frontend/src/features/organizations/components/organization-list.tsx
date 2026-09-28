"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Plus } from "@phosphor-icons/react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { PaginationBar } from "@/components/common/pagination-bar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
        <div className="space-y-2">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      )}

      {isError && <p className="text-sm text-destructive">{te(errorKey(error))}</p>}

      {data && data.content.length === 0 && (
        <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />
      )}

      {data && data.content.length > 0 && (
        <>
          <div className="space-y-4">
            {data.content.map((org) => (
              <Link
                key={org.id}
                href={`/organizations/${org.id}`}
                aria-label={org.name}
                className="group grid overflow-hidden rounded-3xl border bg-card shadow-sm transition-all hover:border-primary/50 hover:shadow-[0_18px_50px_-28px_var(--primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:grid-cols-[minmax(0,1.35fr)_minmax(17rem,.65fr)]"
              >
                <div className="min-w-0 p-6 sm:p-8">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{t("cardLabel")}</p>
                  <h2 className="mt-3 font-heading text-2xl font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary sm:text-3xl">{org.name}</h2>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{org.description || t("cardNoDescription")}</p>
                </div>
                <div className="flex min-w-0 flex-col justify-between gap-8 border-t bg-muted/20 p-6 sm:p-8 lg:border-t-0 lg:border-l">
                  <div className="flex items-start justify-between gap-4">
                    <Badge variant="outline" className="px-2.5 py-1">{t(`statusValues.${org.status}`)}</Badge>
                    <ArrowUpRight size={20} className="shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-primary">{t("cardOpen")}</p>
                    <p className="text-xs text-muted-foreground">{t("cardCreated", { date: new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(org.createdAt)) })}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
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

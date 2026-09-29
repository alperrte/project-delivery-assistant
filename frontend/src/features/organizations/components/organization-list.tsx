"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "@phosphor-icons/react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { PaginationBar } from "@/components/common/pagination-bar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { errorKey } from "@/lib/api/error-message";
import { organizationsApi } from "../api";
import { OrganizationFormDialog } from "./organization-form-dialog";

export function OrganizationList() {
  const t = useTranslations("organizations");
  const locale = useLocale();
  const te = useTranslations("errors");
  const router = useRouter();
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columns.name")}</TableHead>
                <TableHead>{t("columns.status")}</TableHead>
                <TableHead className="text-right">{t("columns.updatedAt")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.content.map((org) => (
                <TableRow key={org.id} className="cursor-pointer" onClick={() => router.push(`/organizations/${org.id}`)}>
                  <TableCell className="whitespace-normal">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="grid size-9 shrink-0 place-items-center rounded-lg border border-primary/25 bg-primary/10 font-heading text-sm font-semibold text-primary"
                      >
                        {org.name.slice(0, 1).toLocaleUpperCase(locale)}
                      </span>
                      <div className="min-w-0">
                        <Link
                          href={`/organizations/${org.id}`}
                          onClick={(event) => event.stopPropagation()}
                          className="block truncate text-sm font-medium text-foreground hover:text-primary hover:underline"
                        >
                          {org.name}
                        </Link>
                        <p className="truncate text-xs text-muted-foreground">{org.description || t("cardNoDescription")}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
                      <span className={`size-2 shrink-0 rounded-full ${org.status === "ACTIVE" ? "bg-success" : "bg-muted-foreground/40"}`} aria-hidden="true" />
                      {t(`statusValues.${org.status}`)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">{date.format(new Date(org.updatedAt))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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

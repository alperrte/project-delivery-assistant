"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columns.name")}</TableHead>
                <TableHead>{t("columns.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.content.map((org) => (
                <TableRow key={org.id}>
                  <TableCell>
                    <Link href={`/organizations/${org.id}`} className="font-medium text-foreground hover:underline">
                      {org.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{org.status}</TableCell>
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

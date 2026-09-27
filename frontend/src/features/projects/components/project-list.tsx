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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { errorKey } from "@/lib/api/error-message";
import { projectsApi } from "../api";
import { ProjectCreateDialog } from "./project-create-dialog";

export function ProjectList() {
  const t = useTranslations("projects");
  const te = useTranslations("errors");
  const [page, setPage] = useState(0);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["projects", page],
    queryFn: () => projectsApi.list(page),
  });

  return (
    <div>
      <PageHeader
        title={t("title")}
        description={t("description")}
        action={
          <ProjectCreateDialog
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
                <TableHead>{t("columns.priority")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.content.map((project) => (
                <TableRow key={project.id}>
                  <TableCell>
                    <Link href={`/projects/${project.slug}`} className="font-medium text-foreground hover:underline">
                      {project.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{project.status}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{project.priority}</TableCell>
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

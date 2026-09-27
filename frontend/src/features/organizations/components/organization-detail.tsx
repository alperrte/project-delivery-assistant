"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PencilSimple, Archive } from "@phosphor-icons/react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { PaginationBar } from "@/components/common/pagination-bar";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { errorKey } from "@/lib/api/error-message";
import { organizationsApi } from "../api";
import { OrganizationFormDialog } from "./organization-form-dialog";

export function OrganizationDetail({ organizationId }: { organizationId: string }) {
  const t = useTranslations("organizations");
  const te = useTranslations("errors");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);

  const { data: org, isLoading, isError, error } = useQuery({
    queryKey: ["organizations", organizationId],
    queryFn: () => organizationsApi.detail(organizationId),
  });

  const { data: projects } = useQuery({
    queryKey: ["organizations", organizationId, "projects", page],
    queryFn: () => organizationsApi.projects(organizationId, page),
    enabled: !!org,
  });

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (isError) return <p className="text-sm text-destructive">{te(errorKey(error))}</p>;
  if (!org) return null;

  const archived = org.status === "ARCHIVED";

  return (
    <div>
      <PageHeader
        title={org.name}
        description={org.description ?? undefined}
        action={
          !archived && (
            <div className="flex gap-2">
              <OrganizationFormDialog
                organization={org}
                trigger={
                  <Button variant="outline">
                    <PencilSimple data-icon="inline-start" size={16} />
                    {t("edit")}
                  </Button>
                }
              />
              <ConfirmDialog
                trigger={
                  <Button variant="destructive">
                    <Archive data-icon="inline-start" size={16} />
                    {t("archive")}
                  </Button>
                }
                title={t("archiveConfirmTitle")}
                description={t("archiveConfirmDescription")}
                confirmLabel={t("archive")}
                cancelLabel={t("cancel")}
                destructive
                onConfirm={async () => {
                  await organizationsApi.archive(org.id);
                  await queryClient.invalidateQueries({ queryKey: ["organizations"] });
                  router.push("/organizations");
                }}
              />
            </div>
          )
        }
      />

      {archived && <Badge variant="outline" className="mb-4">{t("archivedBadge")}</Badge>}

      <h2 className="mb-3 text-sm font-medium text-foreground">{t("projectsHeading")}</h2>

      {projects && projects.content.length === 0 && (
        <EmptyState title={t("noProjects")} />
      )}

      {projects && projects.content.length > 0 && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columns.name")}</TableHead>
                <TableHead>{t("columns.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.content.map((project) => (
                <TableRow key={project.id}>
                  <TableCell>
                    <Link href={`/projects/${project.slug}`} className="font-medium text-foreground hover:underline">
                      {project.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{project.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PaginationBar
            page={projects.page}
            totalPages={projects.totalPages}
            totalElements={projects.totalElements}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}

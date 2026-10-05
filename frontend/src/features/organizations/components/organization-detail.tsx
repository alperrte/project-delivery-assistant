"use client";

import { useState } from "react";
import Link from "@/i18n/navigation";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, PencilSimple, Archive } from "@phosphor-icons/react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { PaginationBar } from "@/components/common/pagination-bar";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageFailure } from "@/features/errors/page-failure";
import { useSession } from "@/features/auth/hooks/use-session";
import { ProjectRow } from "@/features/projects/components/project-card";
import { organizationsApi } from "../api";

export function OrganizationDetail({ organizationId }: { organizationId: string }) {
  const t = useTranslations("organizations");
  const tp = useTranslations("projects");
  const { data: user } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);

  const { data: org, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["organizations", organizationId],
    queryFn: () => organizationsApi.detail(organizationId),
  });

  const { data: projects } = useQuery({
    queryKey: ["organizations", organizationId, "projects", page],
    queryFn: () => organizationsApi.projects(organizationId, page),
    enabled: !!org,
  });

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (isError) return <PageFailure error={error} onRetry={() => { void refetch(); }} />;
  if (!org) return null;

  const archived = org.status === "ARCHIVED";
  const isOwner = user?.id === org.ownerUserId;

  return (
    <div>
      <Link href="/organizations" className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft size={16} aria-hidden="true" />{t("backToOrganizations")}
      </Link>
      <PageHeader
        title={org.name}
        description={org.description ?? undefined}
        action={
          !archived && isOwner && (
            <div className="flex gap-2">
              <Link href={`/organizations/${org.id}/edit`} className={buttonVariants({ variant: "outline" })}>
                <PencilSimple data-icon="inline-start" size={16} aria-hidden="true" />
                {t("edit")}
              </Link>
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

      {archived && <Badge variant="outline" className="mb-5 px-2.5 py-1">{t("archivedBadge")}</Badge>}

      <div className="mb-4 border-t pt-7">
        <h2 className="text-lg font-semibold text-foreground">{t("projectsHeading")}</h2>
      </div>

      {projects && projects.content.length === 0 && (
        <EmptyState title={t("noProjects")} />
      )}

      {projects && projects.content.length > 0 && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tp("columns.name")}</TableHead>
                <TableHead>{tp("columns.status")}</TableHead>
                <TableHead>{tp("columns.priority")}</TableHead>
                <TableHead>{tp("columns.techStack")}</TableHead>
                <TableHead className="text-right">{tp("columns.updatedAt")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.content.map((project) => <ProjectRow key={project.id} project={project} />)}
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

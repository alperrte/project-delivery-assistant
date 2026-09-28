"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, PencilSimple, Archive } from "@phosphor-icons/react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { PaginationBar } from "@/components/common/pagination-bar";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { errorKey } from "@/lib/api/error-message";
import { useSession } from "@/features/auth/hooks/use-session";
import { ProjectCard } from "@/features/projects/components/project-card";
import { organizationsApi } from "../api";
import { OrganizationFormDialog } from "./organization-form-dialog";

export function OrganizationDetail({ organizationId }: { organizationId: string }) {
  const t = useTranslations("organizations");
  const te = useTranslations("errors");
  const { data: user } = useSession();
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

      {archived && <Badge variant="outline" className="mb-5 px-2.5 py-1">{t("archivedBadge")}</Badge>}

      <div className="mb-4 border-t pt-7">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{t("projectsLabel")}</p>
        <h2 className="mt-1 font-heading text-2xl font-semibold text-foreground">{t("projectsHeading")}</h2>
      </div>

      {projects && projects.content.length === 0 && (
        <EmptyState title={t("noProjects")} />
      )}

      {projects && projects.content.length > 0 && (
        <>
          <div className="space-y-4">
            {projects.content.map((project) => <ProjectCard key={project.id} project={project} />)}
          </div>
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

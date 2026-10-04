"use client";

import { useState } from "react";
import Link from "@/i18n/navigation";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, PencilSimple, Archive } from "@phosphor-icons/react";
import { OrganizationProfileHeader } from "./organization-profile-header";
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
import { organizationKeys, invalidateOrganizationQueries } from "../queries";
import { organizationsApi, organizationImageSource } from "../api";

export function OrganizationDetail({ organizationId }: { organizationId: string }) {
  const t = useTranslations("organizations");
  const tp = useTranslations("projects");
  const profile = useTranslations("organizations.profile");
  const { data: user } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);

  const { data: org, isLoading, isError, error, refetch } = useQuery({
    queryKey: organizationKeys.detail(organizationId ?? ""),
    queryFn: () => organizationsApi.detail(organizationId),
  });

  const { data: projects } = useQuery({
    queryKey: organizationKeys.projects(organizationId, page),
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
      <OrganizationProfileHeader
        name={org.name}
        description={org.description}
        logoSrc={organizationImageSource(org, "logo")}
        coverSrc={organizationImageSource(org, "cover")}
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
                  await invalidateOrganizationQueries(queryClient);
                  router.push("/organizations");
                }}
              />
            </div>
          )
        }
      />

      {(org.website || org.contactEmail || org.location) && <section aria-label={profile("contactTitle")} className="mt-6 rounded-lg border bg-card p-5">
        <dl className="grid gap-5 sm:grid-cols-3">
          {org.website && <div className="min-w-0"><dt className="text-sm text-muted-foreground">{profile("website")}</dt><dd className="mt-1 break-all text-sm"><a href={org.website} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">{org.website}</a></dd></div>}
          {org.contactEmail && <div className="min-w-0"><dt className="text-sm text-muted-foreground">{profile("contactEmail")}</dt><dd className="mt-1 break-all text-sm"><a href={`mailto:${org.contactEmail}`} className="underline underline-offset-4">{org.contactEmail}</a></dd></div>}
          {org.location && <div className="min-w-0"><dt className="text-sm text-muted-foreground">{profile("location")}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm">{org.location}</dd></div>}
        </dl>
      </section>}

      {org.notes && <section className="mt-6 rounded-xl border bg-surface-2/50 p-5"><h2 className="text-sm font-semibold">{profile("notes")}</h2><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{org.notes}</p></section>}

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

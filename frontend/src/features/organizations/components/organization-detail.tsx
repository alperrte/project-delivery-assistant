"use client";

import { useState } from "react";
import Link from "@/i18n/navigation";
import { useRouter } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PencilSimple, Trash } from "@phosphor-icons/react";
import { OrganizationProfileHeader } from "./organization-profile-header";
import { EmptyState } from "@/components/common/empty-state";
import { EntityStatusPill } from "@/components/common/entity-card";
import { PaginationBar } from "@/components/common/pagination-bar";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageFailure } from "@/features/errors/page-failure";
import { useSession } from "@/features/auth/hooks/use-session";
import { ProjectRow } from "@/features/projects/components/project-card";
import { cn } from "@/lib/utils";
import { organizationKeys, invalidateOrganizationQueries } from "../queries";
import { organizationsApi, organizationImageSource } from "../api";
import { hasBlockingError } from "@/lib/api/live-sync";

/** One label/value pair of the organization's facts; an empty value reads as a dash so the grid never shifts. */
function Fact({ label, children }: { label: string; children?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm">{children || <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}

export function OrganizationDetail({ organizationId }: { organizationId: string }) {
  const t = useTranslations("organizations");
  const common = useTranslations("common");
  const tp = useTranslations("projects");
  const profile = useTranslations("organizations.profile");
  const locale = useLocale();
  const { data: user } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);

  const { data: org, isLoading, isError, error, refetch } = useQuery({
    queryKey: organizationKeys.detail(organizationId ?? ""),
    queryFn: () => organizationsApi.detail(organizationId),
  });

  const { data: projects, isPending: projectsPending, isError: projectsFailed, error: projectsError } = useQuery({
    queryKey: organizationKeys.projects(organizationId, page),
    queryFn: () => organizationsApi.projects(organizationId, page),
    enabled: !!org,
  });

  // Adjust this component's state before committing an out-of-range page.
  if (projects && !projectsFailed && page >= Math.max(1, projects.totalPages)) {
    setPage(Math.max(0, projects.totalPages - 1));
  }

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (hasBlockingError({ isError, data: org, error })) return <PageFailure error={error} onRetry={() => { void refetch(); }} />;
  if (!org) return null;

  const isOwner = user?.id === org.ownerUserId;
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const active = org.status === "ACTIVE";

  return (
    <div>
      <OrganizationProfileHeader
        name={org.name}
        description={org.description}
        logoShape={org.logoShape} logoSrc={organizationImageSource(org, "logo")}
        coverSrc={organizationImageSource(org, "cover")}
        badge={
          <EntityStatusPill
            className={active ? "border border-success/25 bg-success/10 text-success" : "border border-border bg-muted text-muted-foreground"}
            dotClassName={active ? "bg-success" : "bg-muted-foreground/40"}
            label={t(`statusValues.${org.status}`)}
          />
        }
        corner={
          isOwner && (
            <>
              <Link
                href={`/organizations/${org.id}/edit`}
                title={t("edit")}
                className={cn(buttonVariants({ variant: "outline" }), "bg-background/90 shadow-sm backdrop-blur")}
              >
                <PencilSimple data-icon="inline-start" size={16} aria-hidden="true" />
                {t("edit")}
              </Link>
              <ConfirmDialog
                trigger={
                  <Button variant="outline" className="bg-background/90 text-destructive shadow-sm backdrop-blur hover:text-destructive">
                    <Trash data-icon="inline-start" size={16} aria-hidden="true" />
                    {t("delete")}
                  </Button>
                }
                title={t("deleteConfirmTitle")}
                description={t("deleteConfirmDescription")}
                confirmLabel={t("deleteConfirm")}
                cancelLabel={t("cancel")}
                destructive
                requireText={{
                  value: org.name,
                  label: t.rich("deleteTypeName", {
                    name: org.name,
                    strong: (chunks) => <strong className="font-semibold text-foreground">{chunks}</strong>,
                  }),
                }}
                onConfirm={async () => {
                  await organizationsApi.remove(org.id);
                  await invalidateOrganizationQueries(queryClient);
                  router.push("/organizations");
                }}
              />
            </>
          )
        }
      />

      <section aria-label={profile("detailsTitle")} className="mt-6 rounded-lg border bg-card p-5">
        <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Fact label={profile("website")}>
            {org.website && <a href={org.website} target="_blank" rel="noopener noreferrer" className="break-all underline underline-offset-4">{org.website}</a>}
          </Fact>
          <Fact label={profile("contactEmail")}>
            {org.contactEmail && <a href={`mailto:${org.contactEmail}`} className="break-all underline underline-offset-4">{org.contactEmail}</a>}
          </Fact>
          <Fact label={profile("location")}>{org.location && <span className="whitespace-pre-wrap">{org.location}</span>}</Fact>
          <Fact label={profile("created")}><time dateTime={org.createdAt}>{date.format(new Date(org.createdAt))}</time></Fact>
          <Fact label={t("card.lastUpdate")}><time dateTime={org.updatedAt}>{date.format(new Date(org.updatedAt))}</time></Fact>
          <Fact label={t("projectsHeading")}>{projects && String(projects.totalElements)}</Fact>
        </dl>
      </section>

      {org.notes && <section className="mt-6 rounded-xl border bg-surface-2/50 p-5"><h2 className="text-sm font-semibold">{profile("notes")}</h2><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{org.notes}</p></section>}

      <div className="mb-4 mt-7 border-t pt-7">
        <h2 className="text-lg font-semibold text-foreground">{t("projectsHeading")}</h2>
      </div>

      {projectsPending && <div data-testid="organization-projects-loading" role="status" aria-live="polite">
        <span className="sr-only">{common("loading")}</span><Skeleton className="h-28 w-full" />
      </div>}
      {projectsFailed && <div data-testid="organization-projects-error"><PageFailure error={projectsError} onRetry={() => {
        // The dataset may have shrunk while this page failed; previous pages must also be fresh when clamping.
        void queryClient.invalidateQueries({ queryKey: ["organizations", "projects", organizationId] });
      }} /></div>}
      {!projectsPending && !projectsFailed && projects && projects.content.length === 0 && (
        <EmptyState title={t("noProjects")} />
      )}

      {!projectsFailed && projects && projects.content.length > 0 && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tp("columns.name")}</TableHead>
                <TableHead>{tp("columns.status")}</TableHead>
                <TableHead>{tp("columns.priority")}</TableHead>
                <TableHead>{tp("columns.type")}</TableHead>
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

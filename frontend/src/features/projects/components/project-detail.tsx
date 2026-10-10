"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "@/i18n/navigation";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import {
  Users, CalendarBlank, Code,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { PageFailure } from "@/features/errors/page-failure";
import { InvitationsPage } from "@/features/invitations/components/invitations-page";
import { TeamsPage } from "@/features/squads/components/teams-page";
import { CriteriaList } from "@/features/criteria/components/criteria-list";
import { RepositorySettings } from "@/features/repository/components/repository-settings";
import { projectsApi, projectLogoSource } from "../api";
import { projectSection, projectSectionHref, type ProjectSection } from "../project-sections";
import { useCurrentMember } from "../hooks/use-current-member";
import { projectStatusBadgeClass, projectPriorityBadgeClass } from "../status-colors";
import { ProjectMark } from "./project-mark";
import { ProjectOverview } from "./project-overview";
import { ProjectSettingsForm } from "./project-settings-form";
import { PageTitle } from "@/components/common/page-title";

export function ProjectDetail({ slug }: { slug: string }) {
  const t = useTranslations("projects.detail");
  const tp = useTranslations("projects.overview");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { data: project, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["projects", "by-slug", slug],
    queryFn: () => projectsApi.bySlug(slug),
  });

  const { isManager, isLoading: memberLoading } = useCurrentMember(project?.id ?? "");
  const { data: home } = useQuery({
    queryKey: ["projects", project?.id, "home"],
    queryFn: () => projectsApi.home(project!.id),
    enabled: !!project,
  });

  const section = projectSection(searchParams.get("section"), isManager);
  const setSection = useCallback((next: ProjectSection) => {
    router.push(projectSectionHref(pathname, next), { scroll: false });
  }, [pathname, router]);

  if (isLoading || memberLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (isError) return <PageFailure error={error} onRetry={() => { void refetch(); }} />;
  if (!project) return null;

  return (
    <Tabs value={section} className="project-workspace min-w-0">
        <div className="min-w-0 space-y-6">
          <div className="flex flex-wrap items-start gap-4 sm:gap-5">
            <div aria-hidden="true" data-testid="project-header-mark" className="grid size-14 shrink-0 place-items-center rounded-xl border border-primary/30 bg-primary/10 font-heading text-xl font-semibold text-primary sm:size-16">
              <ProjectMark name={project.name} src={projectLogoSource(project)} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <PageTitle className="font-heading text-[1.65rem] font-bold leading-tight text-foreground sm:text-[2rem]">{project.name}</PageTitle>
                <Badge className={`px-2.5 py-0.5 ${projectStatusBadgeClass(project.status)}`}>{tp(`statusValues.${project.status}`)}</Badge>
                <Badge className={`px-2.5 py-0.5 ${projectPriorityBadgeClass(project.priority)}`}>{tp(`priorityValues.${project.priority}`)}</Badge>
              </div>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">{project.description || project.projectGoal || tp("noGoal")}</p>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><CalendarBlank size={15} aria-hidden="true" />{t("createdAt", { date: new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(project.createdAt)) })}</span>
                {home && <span className="inline-flex items-center gap-1.5"><Users size={15} aria-hidden="true" />{tp("teamMembers", { count: home.teamMemberCount })}</span>}
                <span className="inline-flex items-center gap-1.5"><Code size={15} aria-hidden="true" />{home?.repository.connected ? `${home.repository.repositoryOwner}/${home.repository.repositoryName}` : tp("noRepository")}</span>
              </div>
            </div>
          </div>
          <TabsContent value="overview"><ProjectOverview project={project} isManager={isManager} onNavigate={setSection} /></TabsContent>
          <TabsContent value="criteria"><CriteriaList slug={project.slug} projectId={project.id} isManager={isManager} /></TabsContent>
          <TabsContent value="teams"><TeamsPage project={project} isManager={isManager} /></TabsContent>
          {isManager && <TabsContent value="invitations"><InvitationsPage projectId={project.id} /></TabsContent>}
          <TabsContent value="repository"><RepositorySettings projectId={project.id} isManager={isManager} /></TabsContent>
          {isManager && <TabsContent value="settings"><ProjectSettingsForm project={project} organization={home?.organization} /></TabsContent>}
        </div>
      </Tabs>
  );
}

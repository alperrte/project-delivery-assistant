"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorKey } from "@/lib/api/error-message";
import { MemberList } from "@/features/projects/components/members/member-list";
import { InvitationsPanel } from "@/features/invitations/components/invitations-panel";
import { SquadList } from "@/features/squads/components/squad-list";
import { CriteriaList } from "@/features/criteria/components/criteria-list";
import { RepositorySettings } from "@/features/repository/components/repository-settings";
import { projectsApi } from "../api";
import { useCurrentMember } from "../hooks/use-current-member";
import { ProjectOverview } from "./project-overview";
import { ProjectSettingsForm } from "./project-settings-form";

export function ProjectDetail({ slug }: { slug: string }) {
  const t = useTranslations("projects.detail");
  const te = useTranslations("errors");

  const { data: project, isLoading, isError, error } = useQuery({
    queryKey: ["projects", "by-slug", slug],
    queryFn: () => projectsApi.bySlug(slug),
  });

  const { isManager } = useCurrentMember(project?.id ?? "");

  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (isError) return <p className="text-sm text-destructive">{te(errorKey(error))}</p>;
  if (!project) return null;

  return (
    <div>
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{t("tabs.overview")}</TabsTrigger>
          <TabsTrigger value="criteria">{t("tabs.criteria")}</TabsTrigger>
          <TabsTrigger value="members">{t("tabs.members")}</TabsTrigger>
          {isManager && <TabsTrigger value="invitations">{t("tabs.invitations")}</TabsTrigger>}
          <TabsTrigger value="squads">{t("tabs.squads")}</TabsTrigger>
          <TabsTrigger value="repository">{t("tabs.repository")}</TabsTrigger>
          {isManager && <TabsTrigger value="settings">{t("tabs.settings")}</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="pt-4">
          <ProjectOverview project={project} />
        </TabsContent>
        <TabsContent value="criteria" className="pt-4">
          <CriteriaList projectId={project.id} isManager={isManager} />
        </TabsContent>
        <TabsContent value="members" className="pt-4">
          <MemberList projectId={project.id} isManager={isManager} />
        </TabsContent>
        {isManager && (
          <TabsContent value="invitations" className="pt-4">
            <InvitationsPanel projectId={project.id} />
          </TabsContent>
        )}
        <TabsContent value="squads" className="pt-4">
          <SquadList projectId={project.id} isManager={isManager} />
        </TabsContent>
        <TabsContent value="repository" className="pt-4">
          <RepositorySettings projectId={project.id} isManager={isManager} />
        </TabsContent>
        {isManager && (
          <TabsContent value="settings" className="pt-4">
            <ProjectSettingsForm project={project} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorKey } from "@/lib/api/error-message";
import { MemberList } from "@/features/projects/components/members/member-list";
import { InvitationsPanel } from "@/features/invitations/components/invitations-panel";
import { SquadList } from "@/features/squads/components/squad-list";
import { projectsApi } from "../api";
import { useCurrentMember } from "../hooks/use-current-member";
import { ProjectOverview } from "./project-overview";

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
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="font-heading text-xl font-semibold text-foreground">{project.name}</h1>
        <Badge variant="outline">{project.status}</Badge>
        <Badge variant="secondary">{project.priority}</Badge>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{t("tabs.overview")}</TabsTrigger>
          <TabsTrigger value="members">{t("tabs.members")}</TabsTrigger>
          {isManager && <TabsTrigger value="invitations">{t("tabs.invitations")}</TabsTrigger>}
          <TabsTrigger value="squads">{t("tabs.squads")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="pt-4">
          <ProjectOverview projectId={project.id} />
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
      </Tabs>
    </div>
  );
}

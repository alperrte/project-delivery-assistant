import { useQuery } from "@tanstack/react-query";
import { projectLogoUrl, projectsApi } from "@/features/projects/api";
import { useCurrentMember } from "@/features/projects/hooks/use-current-member";
import type { Project } from "@/features/projects/types";

/** The project behind a `/projects/[slug]/...` route plus what the signed-in user may do in it. */
export function useProjectContext(slug: string) {
  const project = useQuery({
    queryKey: ["projects", "by-slug", slug],
    queryFn: () => projectsApi.bySlug(slug),
  });
  const member = useCurrentMember(project.data?.id ?? "");
  return { project, member, projectId: project.data?.id ?? "", isManager: member.isManager };
}

export function projectLogoSrc(project: Pick<Project, "id" | "logoVersion">): string | null {
  return project.logoVersion == null ? null : projectLogoUrl(project.id, project.logoVersion);
}

/** Prefix shared by every team query of a project, so one invalidation refreshes lists, details and rosters. */
export const teamsKey = (projectId: string) => ["projects", projectId, "squads"] as const;

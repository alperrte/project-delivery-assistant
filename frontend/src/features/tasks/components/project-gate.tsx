"use client";

import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/features/auth/hooks/use-session";
import { useProjectContext } from "@/features/squads/hooks";
import type { Project } from "@/features/projects/types";
import { PageFailure } from "@/features/errors/page-failure";

export type ProjectGateContext = {
  slug: string;
  project: Project;
  projectId: string;
  isManager: boolean;
  userId: string;
};

export function PageSkeleton() {
  return (
    <div className="space-y-5" aria-hidden="true">
      <Skeleton className="h-14 w-2/3 rounded-xl" />
      <Skeleton className="h-10 w-full rounded-xl" />
      <Skeleton className="h-80 w-full rounded-2xl" />
    </div>
  );
}

/**
 * Every project scoped task screen needs the project, the signed-in member and the manager flag first.
 * This resolves them once and renders the same loading and failure states everywhere.
 */
export function ProjectGate({ slug, children }: { slug: string; children: (context: ProjectGateContext) => ReactNode }) {
  const { data: user } = useSession();
  const { project, member, isManager } = useProjectContext(slug);

  if (project.isPending || (!!project.data && member.isPending)) return <PageSkeleton />;
  const failure = project.error ?? member.error;
  if (failure) {
    return <PageFailure error={failure} onRetry={() => { void (project.error ? project.refetch() : member.refetch()); }} />;
  }
  if (!project.data || !user) return <PageSkeleton />;

  return <>{children({ slug, project: project.data, projectId: project.data.id, isManager, userId: user.id })}</>;
}

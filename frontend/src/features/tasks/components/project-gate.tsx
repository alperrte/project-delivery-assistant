"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/features/auth/hooks/use-session";
import { useProjectContext } from "@/features/squads/hooks";
import type { Project } from "@/features/projects/types";
import { errorKey } from "@/lib/api/error-message";

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
  const te = useTranslations("errors");
  const t = useTranslations("tasks.common");
  const { data: user } = useSession();
  const { project, member, isManager } = useProjectContext(slug);

  if (project.isPending || (!!project.data && member.isPending)) return <PageSkeleton />;
  const failure = project.error ?? member.error;
  if (failure) {
    return (
      <div className="space-y-4">
        <p role="alert" className="text-sm text-destructive">{te(errorKey(failure))}</p>
        <Link href="/projects" className={buttonVariants({ variant: "outline" })}>
          {t("backToProjects")}
        </Link>
      </div>
    );
  }
  if (!project.data || !user) return <PageSkeleton />;

  return <>{children({ slug, project: project.data, projectId: project.data.id, isManager, userId: user.id })}</>;
}

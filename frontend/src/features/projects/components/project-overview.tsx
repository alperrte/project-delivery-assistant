"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { errorKey } from "@/lib/api/error-message";
import { projectsApi } from "../api";

export function ProjectOverview({ projectId }: { projectId: string }) {
  const t = useTranslations("projects.overview");
  const te = useTranslations("errors");

  const { data: home, isLoading, isError, error } = useQuery({
    queryKey: ["projects", projectId, "home"],
    queryFn: () => projectsApi.home(projectId),
  });

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (isError) return <p className="text-sm text-destructive">{te(errorKey(error))}</p>;
  if (!home) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div className="rounded-xl border p-4">
        <p className="text-xs text-muted-foreground">{t("organization")}</p>
        <p className="mt-1 text-sm font-medium">{home.organization?.name ?? t("noOrganization")}</p>
      </div>

      <div className="rounded-xl border p-4">
        <p className="text-xs text-muted-foreground">{t("managers")}</p>
        <p className="mt-1 text-sm font-medium">
          {home.managers.length > 0 ? home.managers.map((m) => m.nickname).join(", ") : "—"}
        </p>
      </div>

      <div className="rounded-xl border p-4">
        <p className="text-xs text-muted-foreground">{t("teamMembers")}</p>
        <p className="mt-1 text-sm font-medium">{home.teamMemberCount}</p>
      </div>

      <div className="rounded-xl border p-4">
        <p className="text-xs text-muted-foreground">{t("criteriaProgress")}</p>
        <p className="mt-1 text-sm font-medium">
          {home.criteriaProgress.completed} / {home.criteriaProgress.total}
        </p>
      </div>

      <div className="rounded-xl border p-4 sm:col-span-2 lg:col-span-1">
        <p className="text-xs text-muted-foreground">{t("repository")}</p>
        {home.repository.connected ? (
          <div className="mt-1 space-y-1 text-sm">
            <p className="font-medium">
              {home.repository.repositoryOwner}/{home.repository.repositoryName}
            </p>
            {home.repository.githubUnavailable ? (
              <p className="text-muted-foreground">{t("githubUnavailable")}</p>
            ) : home.repository.lastCommit ? (
              <p className="truncate text-muted-foreground">{home.repository.lastCommit.message}</p>
            ) : null}
          </div>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">{t("noRepository")}</p>
        )}
      </div>
    </div>
  );
}

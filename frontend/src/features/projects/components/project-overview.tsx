"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTranslations, useLocale } from "next-intl";
import { CalendarBlank, Users, GithubLogo } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Progress, ProgressTrack, ProgressIndicator } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { errorKey } from "@/lib/api/error-message";
import { projectsApi } from "../api";
import type { Project } from "../types";

export function ProjectOverview({ project }: { project: Project }) {
  const t = useTranslations("projects.overview");
  const te = useTranslations("errors");
  const locale = useLocale();

  const { data: home, isLoading, isError, error } = useQuery({
    queryKey: ["projects", project.id, "home"],
    queryFn: () => projectsApi.home(project.id),
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (isError) return <p className="text-sm text-destructive">{te(errorKey(error))}</p>;
  if (!home) return null;

  const progressPercent =
    home.criteriaProgress.total === 0
      ? 0
      : Math.round((home.criteriaProgress.completed / home.criteriaProgress.total) * 100);

  return (
    <div className="max-w-3xl space-y-6 border-t pt-6">
      {/* Header: the one deliberate hero moment on this screen — everything below stays quiet. */}
      <div>
        {home.organization && (
          <Link
            href={`/organizations/${home.organization.id}`}
            className="text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            {home.organization.name}
          </Link>
        )}
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">{home.name}</h1>
          <Badge variant="outline">{t(`statusValues.${home.status}`)}</Badge>
          <Badge variant="secondary">{t(`priorityValues.${home.priority}`)}</Badge>
        </div>
        {project.projectGoal && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{project.projectGoal}</p>}
      </div>

      {/* Quiet stat line — plain text, not a row of identical boxes. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Users size={16} />
          {t("teamMembers", { count: home.teamMemberCount })}
        </span>
        {home.managers.length > 0 && (
          <span>{t("managedBy", { names: home.managers.map((m) => m.nickname).join(", ") })}</span>
        )}
        {home.targetEndDate && (
          <span className="inline-flex items-center gap-1.5">
            <CalendarBlank size={16} />
            {t("due", { date: new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(home.targetEndDate)) })}
          </span>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-sm font-medium text-foreground">{t("criteriaProgress")}</h2>
            <span className="tabular-nums text-sm text-muted-foreground">
              {home.criteriaProgress.completed}/{home.criteriaProgress.total}
            </span>
          </div>
          <Progress value={progressPercent}>
            <ProgressTrack>
              <ProgressIndicator />
            </ProgressTrack>
          </Progress>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-medium text-foreground">{t("repository")}</h2>
          {home.repository.connected ? (
            <div className="flex items-start gap-2.5 text-sm">
              <GithubLogo size={18} className="mt-0.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">
                  {home.repository.repositoryOwner}/{home.repository.repositoryName}
                </p>
                {home.repository.githubUnavailable ? (
                  <p className="text-muted-foreground">{t("githubUnavailable")}</p>
                ) : home.repository.lastCommit ? (
                  <p className="truncate text-muted-foreground">{home.repository.lastCommit.message}</p>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("noRepository")}</p>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTranslations, useLocale } from "next-intl";
import { ArrowRight, ArrowUpRight, CalendarBlank, GithubLogo, UsersThree } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Progress, ProgressTrack, ProgressIndicator } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { errorKey } from "@/lib/api/error-message";
import { projectsApi } from "../api";
import type { Project } from "../types";

type OverviewSection = "criteria" | "members" | "repository" | "settings";

export function ProjectOverview({
  project,
  isManager,
  onNavigate,
}: {
  project: Project;
  isManager: boolean;
  onNavigate: (section: OverviewSection) => void;
}) {
  const t = useTranslations("projects.overview");
  const te = useTranslations("errors");
  const locale = useLocale();

  const { data: home, isLoading, isError, error } = useQuery({
    queryKey: ["projects", project.id, "home"],
    queryFn: () => projectsApi.home(project.id),
  });

  if (isLoading) return <Skeleton className="h-96 w-full rounded-3xl" />;
  if (isError) return <p className="text-sm text-destructive">{te(errorKey(error))}</p>;
  if (!home) return null;

  const progressPercent = home.criteriaProgress.total === 0
    ? 0
    : Math.round((home.criteriaProgress.completed / home.criteriaProgress.total) * 100);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{t("sectionLabel")}</p>
          <h2 className="mt-1 font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{t("heading")}</h2>
        </div>
        {home.organization && (
          <Link href={`/organizations/${home.organization.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
            {home.organization.name}<ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(19rem,.85fr)]">
        <section className="relative flex min-h-84 flex-col justify-between overflow-hidden rounded-3xl border border-primary/25 bg-[linear-gradient(135deg,#102d56_0%,#0c1d35_68%,#142a4c_100%)] p-7 text-white shadow-[0_24px_70px_-42px_rgb(27_96_216/0.7)] sm:p-9" aria-label={t("criteriaProgress")}>
          <div className="pointer-events-none absolute -top-36 -right-24 size-80 rounded-full border border-white/10" aria-hidden="true" />
          <div className="pointer-events-none absolute -top-20 -right-8 size-52 rounded-full border border-white/10" aria-hidden="true" />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">{t("criteriaProgress")}</p>
            {home.criteriaProgress.total > 0 ? (
              <>
                <div className="mt-5 flex items-end gap-4">
                  <span className="font-heading text-7xl font-semibold leading-none tracking-tight sm:text-8xl">{progressPercent}<span className="text-4xl text-blue-200">%</span></span>
                </div>
                <p className="mt-4 text-sm text-blue-100">{t("progressCount", { completed: home.criteriaProgress.completed, total: home.criteriaProgress.total })}</p>
                <Progress value={progressPercent} className="mt-7">
                  <ProgressTrack className="h-2 bg-white/15"><ProgressIndicator className="bg-white" /></ProgressTrack>
                </Progress>
              </>
            ) : (
              <>
                <h3 className="mt-7 max-w-lg font-heading text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{t("noCriteriaTitle")}</h3>
                <p className="mt-4 max-w-md text-sm leading-6 text-blue-100">{t("noCriteriaDescription")}</p>
              </>
            )}
          </div>
          <button type="button" onClick={() => onNavigate("criteria")} className="relative mt-8 inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            {home.criteriaProgress.total === 0 && isManager ? t("defineCriteria") : t("viewCriteria")}<ArrowRight size={16} aria-hidden="true" />
          </button>
        </section>

        <section className="flex min-h-84 flex-col rounded-3xl border bg-card p-7 shadow-sm sm:p-9" aria-label={t("team")}>
          <UsersThree size={28} className="text-primary" aria-hidden="true" />
          <p className="mt-6 text-sm font-medium text-muted-foreground">{t("team")}</p>
          <p className="mt-2 font-heading text-6xl font-semibold tracking-tight text-foreground">{home.teamMemberCount}</p>
          <p className="mt-2 text-sm text-muted-foreground">{t("teamMembers", { count: home.teamMemberCount })}</p>
          {home.managers.length > 0 && (
            <p className="mt-7 border-t pt-5 text-sm text-muted-foreground">{t("managedBy", { names: home.managers.map((manager) => manager.nickname).join(", ") })}</p>
          )}
          <Button variant="outline" className="mt-auto w-fit" onClick={() => onNavigate("members")}>
            {t("viewMembers")}<ArrowRight size={16} aria-hidden="true" />
          </Button>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="flex flex-col rounded-3xl border bg-card p-7 shadow-sm sm:p-8" aria-label={t("projectProfile")}>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{t("projectProfile")}</p>
          <h3 className="mt-3 font-heading text-xl font-semibold text-foreground">{t("goal")}</h3>
          <p className="mt-2 min-h-12 text-sm leading-6 text-muted-foreground">{project.projectGoal || t("noGoal")}</p>
          <div className="mt-6 grid gap-5 border-t pt-5 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("techStack")}</p>
              <p className="mt-2 text-sm font-medium text-foreground">{project.techStack || t("notSpecified")}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("timeline")}</p>
              <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                <CalendarBlank size={16} className="text-muted-foreground" aria-hidden="true" />
                {home.targetEndDate ? date.format(new Date(home.targetEndDate)) : t("notSpecified")}
              </p>
            </div>
          </div>
          {isManager && (
            <Button variant="outline" className="mt-7 w-fit" onClick={() => onNavigate("settings")}>
              {t("editProjectProfile")}<ArrowRight size={16} aria-hidden="true" />
            </Button>
          )}
        </section>

        <section className="flex flex-col rounded-3xl border bg-card p-7 shadow-sm sm:p-8" aria-label={t("repository")}>
          <GithubLogo size={28} className="text-primary" aria-hidden="true" />
          <h3 className="mt-5 font-heading text-xl font-semibold text-foreground">{t("repository")}</h3>
          {home.repository.connected ? (
            <div className="mt-2 space-y-2">
              <p className="truncate text-sm font-medium text-foreground">{home.repository.repositoryOwner}/{home.repository.repositoryName}</p>
              {home.repository.githubUnavailable ? (
                <p className="text-sm text-muted-foreground">{t("githubUnavailable")}</p>
              ) : home.repository.lastCommit ? (
                <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">{home.repository.lastCommit.message}</p>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("noRepository")}</p>
          )}
          <Button variant="outline" className="mt-auto w-fit" onClick={() => onNavigate("repository")}>
            {home.repository.connected ? t("viewRepository") : isManager ? t("connectRepository") : t("viewRepository")}
            <ArrowRight size={16} aria-hidden="true" />
          </Button>
        </section>
      </div>
    </div>
  );
}

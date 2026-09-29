"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowRight, ArrowUpRight, CalendarBlank,
  Code, EnvelopeSimple, GearSix, GithubLogo, Plus, Stack, Target, UsersThree,
} from "@phosphor-icons/react";
import { Skeleton } from "@/components/ui/skeleton";
import { errorKey } from "@/lib/api/error-message";
import { criteriaApi } from "@/features/criteria/api";
import { invitationsApi } from "@/features/invitations/api";
import { squadsApi } from "@/features/squads/api";
import { projectsApi } from "../api";
import type { Project } from "../types";
import { ProjectCriteriaActivity, ProjectCriteriaTrend } from "./project-criteria-insights";

type OverviewSection = "criteria" | "members" | "invitations" | "squads" | "repository" | "settings";

function Action({ children, onClick, primary = false }: { children: ReactNode; onClick: () => void; primary?: boolean }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex min-h-10 w-full items-center justify-between gap-3 rounded-lg border px-3.5 text-left text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${primary ? "workspace-primary-action border-transparent" : "border-border bg-background/35 text-foreground hover:border-primary/45 hover:bg-primary/10"}`}>
      {children}<ArrowRight size={16} aria-hidden="true" />
    </button>
  );
}

export function ProjectOverview({ project, isManager, onNavigate }: {
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
  const { data: criteria } = useQuery({
    queryKey: ["projects", project.id, "criteria"],
    queryFn: () => criteriaApi.list(project.id),
  });
  const { data: squads } = useQuery({
    queryKey: ["projects", project.id, "squads", 0],
    queryFn: () => squadsApi.list(project.id, 0),
  });
  const { data: invitations } = useQuery({
    queryKey: ["projects", project.id, "invitations", 0],
    queryFn: () => invitationsApi.list(project.id, 0),
    enabled: isManager,
  });

  if (isLoading) return <Skeleton className="h-96 w-full rounded-xl" />;
  if (isError) return <p className="text-sm text-destructive">{te(errorKey(error))}</p>;
  if (!home) return null;

  const progress = home.criteriaProgress.total === 0 ? 0 : Math.round(home.criteriaProgress.completed / home.criteriaProgress.total * 100);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <button type="button" onClick={() => onNavigate("criteria")} className="workspace-panel col-span-2 flex min-h-36 items-center gap-3 p-4 text-left transition-colors hover:border-primary/55 xl:col-span-1">
          <span className="grid size-18 shrink-0 place-items-center rounded-full p-1" style={{ background: `conic-gradient(var(--primary) ${progress}%, var(--border) 0)` }}>
            <span className="grid size-full place-items-center rounded-full bg-card font-heading text-lg font-bold text-foreground">{progress}%</span>
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-medium text-muted-foreground">{t("progressLabel")}</span>
            <span className="mt-1 block font-heading text-base font-semibold text-foreground">{home.criteriaProgress.completed} / {home.criteriaProgress.total}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{t("completedCriteria")}</span>
          </span>
        </button>

        <button type="button" onClick={() => onNavigate("criteria")} className="workspace-panel group flex min-h-36 flex-col justify-between p-4 text-left transition-colors hover:border-primary/55">
          <span className="flex items-start justify-between"><span className="rounded-lg bg-primary/15 p-2 text-primary"><Target size={22} aria-hidden="true" /></span><ArrowUpRight size={17} className="text-muted-foreground group-hover:text-primary" aria-hidden="true" /></span>
          <span><span className="block text-xs font-medium text-muted-foreground">{t("criteriaProgress")}</span><span className="mt-1 block font-heading text-2xl font-bold text-foreground">{home.criteriaProgress.total}</span><span className="text-xs text-muted-foreground">{t("completedCount", { count: home.criteriaProgress.completed })}</span></span>
        </button>

        <button type="button" onClick={() => onNavigate("members")} className="workspace-panel group flex min-h-36 flex-col justify-between p-4 text-left transition-colors hover:border-primary/55">
          <span className="flex items-start justify-between"><span className="rounded-lg bg-primary/15 p-2 text-primary"><UsersThree size={22} aria-hidden="true" /></span><ArrowUpRight size={17} className="text-muted-foreground group-hover:text-primary" aria-hidden="true" /></span>
          <span><span className="block text-xs font-medium text-muted-foreground">{t("team")}</span><span className="mt-1 block font-heading text-2xl font-bold text-foreground">{home.teamMemberCount}</span><span className="text-xs text-muted-foreground">{squads ? t("squadCount", { count: squads.totalElements }) : t("teamMembers", { count: home.teamMemberCount })}</span></span>
        </button>

        {isManager ? (
          <button type="button" onClick={() => onNavigate("invitations")} className="workspace-panel group flex min-h-36 flex-col justify-between p-4 text-left transition-colors hover:border-primary/55">
            <span className="flex items-start justify-between"><span className="rounded-lg bg-warning/15 p-2 text-warning"><EnvelopeSimple size={22} aria-hidden="true" /></span><ArrowUpRight size={17} className="text-muted-foreground group-hover:text-primary" aria-hidden="true" /></span>
            <span><span className="block text-xs font-medium text-muted-foreground">{t("invitations")}</span><span className="mt-1 block font-heading text-2xl font-bold text-foreground">{invitations?.totalElements ?? "—"}</span><span className="text-xs text-muted-foreground">{t("allInvitations")}</span></span>
          </button>
        ) : (
          <button type="button" onClick={() => onNavigate("squads")} className="workspace-panel group flex min-h-36 flex-col justify-between p-4 text-left transition-colors hover:border-primary/55">
            <span className="flex items-start justify-between"><span className="rounded-lg bg-primary/15 p-2 text-primary"><Stack size={22} aria-hidden="true" /></span><ArrowUpRight size={17} className="text-muted-foreground group-hover:text-primary" aria-hidden="true" /></span>
            <span><span className="block text-xs font-medium text-muted-foreground">{t("squads")}</span><span className="mt-1 block font-heading text-2xl font-bold text-foreground">{squads?.totalElements ?? "—"}</span><span className="text-xs text-muted-foreground">{t("viewSquads")}</span></span>
          </button>
        )}

        <button type="button" onClick={() => onNavigate("repository")} className="workspace-panel group flex min-h-36 flex-col justify-between p-4 text-left transition-colors hover:border-primary/55">
          <span className="flex items-start justify-between"><span className="rounded-lg bg-primary/15 p-2 text-primary"><GithubLogo size={22} aria-hidden="true" /></span><ArrowUpRight size={17} className="text-muted-foreground group-hover:text-primary" aria-hidden="true" /></span>
          <span><span className="block text-xs font-medium text-muted-foreground">{t("repository")}</span><span className="mt-2 block truncate text-sm font-semibold text-foreground">{home.repository.connected ? `${home.repository.repositoryOwner}/${home.repository.repositoryName}` : t("noRepository")}</span><span className="text-xs text-muted-foreground">{home.repository.connected ? t("connected") : isManager ? t("connectRepository") : t("viewRepository")}</span></span>
        </button>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(14rem,.8fr)]">
        <ProjectCriteriaActivity criteria={criteria} />
        <ProjectCriteriaTrend criteria={criteria} />

        <section className="workspace-panel min-w-0 p-5" aria-labelledby="overview-actions-heading">
          <h2 id="overview-actions-heading" className="mb-4 text-base font-semibold">{t("quickActions")}</h2>
          <div className="space-y-2.5">
            <Action primary onClick={() => onNavigate("criteria")}><span className="inline-flex items-center gap-2"><Plus size={17} aria-hidden="true" />{home.criteriaProgress.total === 0 && isManager ? t("defineCriteria") : t("viewCriteria")}</span></Action>
            {isManager && <Action onClick={() => onNavigate("invitations")}><span className="inline-flex items-center gap-2"><EnvelopeSimple size={17} aria-hidden="true" />{t("viewInvitations")}</span></Action>}
            <Action onClick={() => onNavigate("repository")}><span className="inline-flex items-center gap-2"><GithubLogo size={17} aria-hidden="true" />{home.repository.connected || !isManager ? t("viewRepository") : t("connectRepository")}</span></Action>
            {isManager && <Action onClick={() => onNavigate("settings")}><span className="inline-flex items-center gap-2"><GearSix size={17} aria-hidden="true" />{t("editProjectProfile")}</span></Action>}
          </div>
        </section>
      </div>

      <section className="workspace-panel flex flex-col gap-x-8 gap-y-4 p-5 md:flex-row md:items-start" aria-label={t("projectProfile")}>
        <div className="w-full flex-1 md:min-w-48">
          <h2 className="text-base font-semibold">{t("projectProfile")}</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{project.projectGoal || t("noGoal")}</p>
        </div>
        <dl className="grid w-full flex-[2] gap-x-6 gap-y-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <div><dt className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarBlank size={15} aria-hidden="true" />{t("timeline")}</dt><dd className="mt-1 font-medium">{home.targetEndDate ? date.format(new Date(home.targetEndDate)) : t("notSpecified")}</dd></div>
          <div><dt className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Code size={15} aria-hidden="true" />{t("techStack")}</dt><dd className="mt-1 font-medium">{project.techStack || t("notSpecified")}</dd></div>
          <div><dt className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><UsersThree size={15} aria-hidden="true" />{t("manager")}</dt><dd className="mt-1 font-medium">{home.managers.map((manager) => manager.nickname).join(", ") || t("notSpecified")}</dd></div>
          {home.organization && <div><dt className="text-xs text-muted-foreground">{t("organization")}</dt><dd className="mt-1 font-medium"><Link href={`/organizations/${home.organization.id}`} className="inline-flex items-center gap-1 text-primary hover:underline">{home.organization.name}<ArrowUpRight size={14} aria-hidden="true" /></Link></dd></div>}
        </dl>
      </section>
    </div>
  );
}

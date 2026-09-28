"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowRight, ArrowUpRight, CalendarBlank, CheckCircle, CircleDashed,
  Code, EnvelopeSimple, GearSix, GithubLogo, Plus, Stack, Target, UsersThree,
} from "@phosphor-icons/react";
import { Skeleton } from "@/components/ui/skeleton";
import { errorKey } from "@/lib/api/error-message";
import { criteriaApi } from "@/features/criteria/api";
import { invitationsApi } from "@/features/invitations/api";
import { squadsApi } from "@/features/squads/api";
import { projectsApi } from "../api";
import type { Project } from "../types";

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
        <section className="workspace-panel min-w-0 p-5" aria-labelledby="overview-criteria-heading">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id="overview-criteria-heading" className="text-base font-semibold">{t("criteriaSnapshot")}</h2>
            <button type="button" onClick={() => onNavigate("criteria")} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">{t("viewAll")}<ArrowRight size={14} aria-hidden="true" /></button>
          </div>
          {!criteria ? <Skeleton className="h-44 w-full" /> : criteria.length > 0 ? (
            <ul className="divide-y divide-border/70">
              {criteria.slice(0, 5).map((criterion) => (
                <li key={criterion.id} className="flex items-center gap-3 py-3 text-sm">
                  {criterion.completed ? <CheckCircle size={19} className="shrink-0 text-success" weight="fill" aria-hidden="true" /> : <CircleDashed size={19} className="shrink-0 text-primary" aria-hidden="true" />}
                  <span className={`min-w-0 flex-1 truncate ${criterion.completed ? "text-muted-foreground line-through" : "text-foreground"}`}>{criterion.title}</span>
                  <span className="text-xs text-muted-foreground">{criterion.completed ? t("done") : t("inProgress")}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex min-h-48 flex-col items-start justify-center">
              <Target size={30} className="text-primary" aria-hidden="true" />
              <h3 className="mt-3 text-base font-semibold">{t("noCriteriaTitle")}</h3>
              <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">{t("noCriteriaDescription")}</p>
            </div>
          )}
        </section>

        <section className="workspace-panel min-w-0 p-5" aria-labelledby="overview-profile-heading">
          <h2 id="overview-profile-heading" className="text-base font-semibold">{t("projectProfile")}</h2>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-primary">{t("goal")}</p>
          <p className="mt-1 line-clamp-3 min-h-14 text-sm leading-6 text-foreground/85">{project.projectGoal || t("noGoal")}</p>
          <dl className="mt-4 space-y-3 border-t pt-4 text-sm">
            <div className="flex items-start justify-between gap-4"><dt className="inline-flex items-center gap-2 text-muted-foreground"><CalendarBlank size={16} aria-hidden="true" />{t("timeline")}</dt><dd className="text-right font-medium">{home.targetEndDate ? date.format(new Date(home.targetEndDate)) : t("notSpecified")}</dd></div>
            <div className="flex items-start justify-between gap-4"><dt className="inline-flex items-center gap-2 text-muted-foreground"><Code size={16} aria-hidden="true" />{t("techStack")}</dt><dd className="max-w-[60%] text-right font-medium">{project.techStack || t("notSpecified")}</dd></div>
            <div className="flex items-start justify-between gap-4"><dt className="inline-flex items-center gap-2 text-muted-foreground"><UsersThree size={16} aria-hidden="true" />{t("manager")}</dt><dd className="max-w-[60%] text-right font-medium">{home.managers.map((manager) => manager.nickname).join(", ") || t("notSpecified")}</dd></div>
          </dl>
          {home.organization && <Link href={`/organizations/${home.organization.id}`} className="mt-5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">{home.organization.name}<ArrowUpRight size={14} aria-hidden="true" /></Link>}
        </section>

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
    </div>
  );
}

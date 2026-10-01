"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowUpRight, CalendarBlank, CaretRight, CheckCircle, Circle,
  Code, EnvelopeSimple, GearSix, GithubLogo, Plus, UsersThree,
} from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { errorKey } from "@/lib/api/error-message";
import { criteriaApi } from "@/features/criteria/api";
import { usePendingInvitationCount } from "@/features/invitations/hooks";
import { squadsApi } from "@/features/squads/api";
import { membersApi } from "../members-api";
import { projectsApi } from "../api";
import type { Project } from "../types";
import { ProjectCriteriaActivity, ProjectCriteriaTrend } from "./project-criteria-insights";

type OverviewSection = "criteria" | "teams" | "invitations" | "repository" | "settings";

function RailRow({ label, value, onClick, leading }: { label: string; value: string; onClick: () => void; leading: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
    >
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-muted-foreground">{label}</span>
        <span className="block truncate text-sm font-medium text-foreground">{value}</span>
      </span>
      <CaretRight size={14} className="shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </button>
  );
}

function Dot({ tone }: { tone: "live" | "primary" | "muted" }) {
  const color = tone === "live" ? "bg-live" : tone === "primary" ? "bg-primary" : "bg-muted-foreground/40";
  return <span className={`size-2 shrink-0 rounded-full ${color}`} aria-hidden="true" />;
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
    queryFn: () => squadsApi.list(project.id, 0, 1),
  });
  const { data: pendingInvitations } = usePendingInvitationCount(project.id, isManager);
  const { data: members } = useQuery({
    queryKey: ["projects", project.id, "members", 0],
    queryFn: () => membersApi.list(project.id, 0, 5),
  });

  if (isLoading) return <Skeleton className="h-96 w-full rounded-xl" />;
  if (isError) return <p className="text-sm text-destructive">{te(errorKey(error))}</p>;
  if (!home) return null;

  const total = home.criteriaProgress.total;
  const completed = home.criteriaProgress.completed;
  const progress = total === 0 ? 0 : Math.round((completed / total) * 100);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  const open = criteria?.filter((c) => !c.completed) ?? [];
  const done = criteria?.filter((c) => c.completed).sort((a, b) => Date.parse(b.completedAt ?? "0") - Date.parse(a.completedAt ?? "0")) ?? [];
  const snapshot = [...open, ...done].slice(0, 5);

  const visibleMembers = members?.content.slice(0, 4) ?? [];
  const extraMembers = Math.max(0, home.teamMemberCount - visibleMembers.length);

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(18rem,1fr)]">
        <section className="workspace-panel min-w-0 p-6" aria-labelledby="criteria-snapshot-heading">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="criteria-snapshot-heading" className="text-base font-semibold text-foreground">{t("criteriaSnapshot")}</h2>
            {total > 0 && (
              <button type="button" onClick={() => onNavigate("criteria")} className="text-sm font-medium text-primary hover:underline">
                {t("viewAll")}
              </button>
            )}
          </div>

          {total === 0 ? (
            <div className="mt-5 flex flex-col items-start gap-3 border-t pt-5">
              <p className="text-sm leading-6 text-muted-foreground">{t("noCriteriaDescription")}</p>
              {isManager && (
                <button
                  type="button"
                  onClick={() => onNavigate("criteria")}
                  className="workspace-primary-action inline-flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-medium"
                >
                  <Plus size={16} aria-hidden="true" />
                  {t("defineCriteria")}
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="font-mono text-3xl font-semibold tabular-nums text-foreground">{progress}%</span>
                <span className="text-sm text-muted-foreground">{t("progressCount", { total, completed })}</span>
              </div>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
              </div>

              <ul className="mt-5 divide-y border-t">
                {snapshot.map((criterion) => (
                  <li key={criterion.id} className="flex items-center gap-3 py-2.5 text-sm">
                    {criterion.completed ? (
                      <CheckCircle size={17} weight="fill" className="shrink-0 text-success" aria-hidden="true" />
                    ) : (
                      <Circle size={17} className="shrink-0 text-muted-foreground/40" aria-hidden="true" />
                    )}
                    <span className={`min-w-0 flex-1 truncate ${criterion.completed ? "text-muted-foreground line-through" : "text-foreground"}`}>
                      {criterion.title}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{criterion.completed ? t("done") : t("inProgress")}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <aside className="flex flex-col divide-y overflow-hidden rounded-[0.875rem] border bg-card shadow-sm">
          <RailRow
            label={t("team")}
            value={t("teamMembers", { count: home.teamMemberCount })}
            onClick={() => onNavigate("teams")}
            leading={
              visibleMembers.length > 0 ? (
                <div className="flex -space-x-2">
                  {visibleMembers.map((member, index) => (
                    <Avatar key={member.userId} name={member.nickname ?? member.userId} tint={index} className="size-7 text-[10px]" />
                  ))}
                  {extraMembers > 0 && (
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-card">
                      +{extraMembers}
                    </span>
                  )}
                </div>
              ) : (
                <UsersThree size={18} className="shrink-0 text-muted-foreground" aria-hidden="true" />
              )
            }
          />
          <RailRow
            label={t("repository")}
            value={home.repository.connected ? `${home.repository.repositoryOwner}/${home.repository.repositoryName}` : t("noRepository")}
            onClick={() => onNavigate("repository")}
            leading={<Dot tone={home.repository.connected ? "live" : "muted"} />}
          />
          {isManager && (
            <RailRow
              label={t("invitations")}
              value={t("pendingInvitations")}
              onClick={() => onNavigate("invitations")}
              leading={<span className="font-mono text-sm font-semibold tabular-nums text-foreground">{pendingInvitations ?? "—"}</span>}
            />
          )}
          <RailRow
            label={t("squads")}
            value={squads ? t("squadCount", { count: squads.totalElements }) : "—"}
            onClick={() => onNavigate("teams")}
            leading={<span className="font-mono text-sm font-semibold tabular-nums text-foreground">{squads?.totalElements ?? "—"}</span>}
          />

          <div className="px-4 py-3">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t("quickActions")}</p>
            <ul>
              {isManager && (
                <li>
                  <button type="button" onClick={() => onNavigate("teams")} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted/60">
                    <EnvelopeSimple size={15} className="text-muted-foreground" aria-hidden="true" />
                    {t("viewInvitations")}
                  </button>
                </li>
              )}
              <li>
                <button type="button" onClick={() => onNavigate("repository")} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted/60">
                  <GithubLogo size={15} className="text-muted-foreground" aria-hidden="true" />
                  {home.repository.connected || !isManager ? t("viewRepository") : t("connectRepository")}
                </button>
              </li>
              {isManager && (
                <li>
                  <button type="button" onClick={() => onNavigate("settings")} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted/60">
                    <GearSix size={15} className="text-muted-foreground" aria-hidden="true" />
                    {t("editProjectProfile")}
                  </button>
                </li>
              )}
            </ul>
          </div>
        </aside>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ProjectCriteriaActivity criteria={criteria} />
        <ProjectCriteriaTrend criteria={criteria} />
      </div>

      <section className="workspace-panel flex flex-col gap-x-8 gap-y-4 p-6 md:flex-row md:items-start" aria-label={t("projectProfile")}>
        <div className="w-full flex-1 md:min-w-48">
          <h2 className="text-base font-semibold text-foreground">{t("projectProfile")}</h2>
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

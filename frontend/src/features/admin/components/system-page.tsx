"use client";

import { useId, useState, type ReactNode } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ArrowClockwise, CheckCircle, MinusCircle, WarningCircle } from "@phosphor-icons/react";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { PaginationBar } from "@/components/common/pagination-bar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSession } from "@/features/auth/hooks/use-session";
import { cn } from "@/lib/utils";
import { adminApi, type AdminProject, type SystemStatus } from "../api";
import { adminKeys } from "../query-keys";
import { ErrorPanel, Section, ToneBadge, useAdminDates, type Tone } from "./admin-ui";

const PROJECT_PAGE_SIZE = 10;

/** The background jobs the server reports by name; an unknown name is shown as it is. */
const JOB_LABELS: Record<string, string> = {
  "retention.analytics": "retentionAnalytics",
  "retention.audit": "retentionAudit",
  "retention.contact": "retentionContact",
  "retention.user-sessions": "retentionUserSessions",
  "auth.pending-registration-cleanup": "pendingRegistrationCleanup",
  "project.repository-commit-scan": "repositoryCommitScan",
  "task.deadline-scan": "taskDeadlineScan",
};

type Health = { key: string; tone: Tone; state: string; hint?: string };

const TONE_ICON: Record<Tone, ReactNode> = {
  success: <CheckCircle size={18} weight="fill" aria-hidden="true" />,
  danger: <WarningCircle size={18} weight="fill" aria-hidden="true" />,
  warning: <WarningCircle size={18} weight="fill" aria-hidden="true" />,
  neutral: <MinusCircle size={18} weight="regular" aria-hidden="true" />,
  info: <CheckCircle size={18} weight="regular" aria-hidden="true" />,
};
const TONE_TEXT: Record<Tone, string> = {
  success: "text-success",
  danger: "text-destructive",
  warning: "text-warning",
  neutral: "text-muted-foreground",
  info: "text-label-blue",
};

function Stat({ label, value, hint, testId }: { label: string; value: ReactNode; hint?: string; testId?: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4" data-testid={testId}>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</dd>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Platform health and operations. Booleans and counters only: the server never sends a secret value. */
export function AdminSystemPage() {
  const t = useTranslations("admin.system");
  const locale = useLocale();
  const ids = useId();
  const { data: me } = useSession();
  const actorId = me?.id;
  const dates = useAdminDates();
  const [projectPage, setProjectPage] = useState(0);

  const status = useQuery({
    queryKey: adminKeys.systemStatus(actorId),
    queryFn: ({ signal }) => adminApi.systemStatus(signal),
    enabled: !!actorId,
  });
  const overview = useQuery({
    queryKey: adminKeys.overview(actorId),
    queryFn: ({ signal }) => adminApi.overview(signal),
    enabled: !!actorId,
  });
  const projects = useQuery({
    queryKey: adminKeys.projects(actorId, projectPage),
    queryFn: ({ signal }) => adminApi.projects({ page: projectPage, size: PROJECT_PAGE_SIZE }, signal),
    enabled: !!actorId,
    placeholderData: keepPreviousData,
  });

  const number = new Intl.NumberFormat(locale);
  const fmt = (value: number) => number.format(value);
  const refreshing = status.isFetching || overview.isFetching || projects.isFetching;
  const refresh = () => {
    void status.refetch();
    void overview.refetch();
    void projects.refetch();
  };

  function health(data: SystemStatus): Health[] {
    const configured = (on: boolean, off: Tone = "neutral"): Pick<Health, "tone" | "state"> =>
      on ? { tone: "success", state: t("states.configured") } : { tone: off, state: t("states.notConfigured") };
    return [
      { key: "status", ...(data.status === "UP" ? { tone: "success" as const, state: t("states.up") } : { tone: "danger" as const, state: t("states.down") }) },
      { key: "database", ...(data.database ? { tone: "success" as const, state: t("states.reachable") } : { tone: "danger" as const, state: t("states.unreachable") }) },
      { key: "mail", ...(data.mailEnabled ? { tone: "success" as const, state: t("states.on") } : { tone: "neutral" as const, state: t("states.off") }) },
      { key: "google", ...configured(data.googleLoginConfigured) },
      { key: "github", ...configured(data.githubLoginConfigured) },
      { key: "apiDocs", ...(data.apiDocsEnabled ? { tone: "info" as const, state: t("states.on") } : { tone: "neutral" as const, state: t("states.off") }) },
      { key: "totpKey", ...configured(data.totpEncryptionKeyConfigured, "danger") },
    ];
  }

  const projectStatus = (project: AdminProject) => (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <ToneBadge tone={project.archived ? "neutral" : project.status === "ACTIVE" ? "success" : "info"}>
        {t.has(`projects.statuses.${project.status}`) ? t(`projects.statuses.${project.status}`) : project.status}
      </ToneBadge>
    </span>
  );

  const projectItems = projects.data?.items ?? [];
  const projectTotal = projects.data?.totalElements ?? 0;

  return (
    <div>
      <PageHeader
        title={t("title")}
        description={t("description")}
        action={
          <Button variant="outline" className="min-h-11" disabled={refreshing} onClick={refresh}>
            <ArrowClockwise size={16} aria-hidden="true" className={cn(refreshing && "animate-spin")} />
            {t("refresh")}
          </Button>
        }
      />

      <Section id={`${ids}-health`} title={t("sections.health")} className="mt-0">
        {status.isError ? (
          <ErrorPanel message={t("errors.status")} retryLabel={t("retry")} onRetry={() => void status.refetch()} />
        ) : !status.data ? (
          <div role="status" aria-label={t("loading")} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 7 }, (_, index) => <Skeleton key={index} className="h-24 w-full" />)}
          </div>
        ) : (
          <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="health">
            {health(status.data).map((item) => (
              <div key={item.key} className="rounded-2xl border bg-card p-4" data-health={item.key}>
                <dt className="text-sm text-muted-foreground">{t(`health.${item.key}.label`)}</dt>
                <dd className={cn("mt-1.5 flex items-center gap-2 text-base font-semibold", TONE_TEXT[item.tone])}>
                  {TONE_ICON[item.tone]}
                  <span data-state={item.tone}>{item.state}</span>
                </dd>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{t(`health.${item.key}.hint`)}</p>
              </div>
            ))}
          </dl>
        )}
      </Section>

      <Section id={`${ids}-ops`} title={t("sections.operations")} description={t("operations.note")}>
        {status.isError ? (
          <ErrorPanel message={t("errors.status")} retryLabel={t("retry")} onRetry={() => void status.refetch()} />
        ) : !status.data ? (
          <div role="status" aria-label={t("loading")} className="grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-24 w-full" />)}
          </div>
        ) : (
          <dl className="grid gap-3 sm:grid-cols-3" data-testid="operations">
            <Stat label={t("operations.activeSessions")} value={fmt(status.data.activeSessions)} hint={t("operations.activeSessionsHint")} testId="stat-sessions" />
            <Stat label={t("operations.clientErrors")} value={fmt(status.data.httpErrorsLast24h.clientErrors)} hint={t("operations.clientErrorsHint")} testId="stat-4xx" />
            <Stat label={t("operations.serverErrors")} value={fmt(status.data.httpErrorsLast24h.serverErrors)} hint={t("operations.serverErrorsHint")} testId="stat-5xx" />
          </dl>
        )}
      </Section>

      <Section id={`${ids}-jobs`} title={t("sections.jobs")} description={t("jobs.description")}>
        {status.isError ? (
          <ErrorPanel message={t("errors.status")} retryLabel={t("retry")} onRetry={() => void status.refetch()} />
        ) : !status.data ? (
          <Skeleton role="status" aria-label={t("loading")} className="h-40 w-full" />
        ) : status.data.scheduledJobs.length === 0 ? (
          <EmptyState title={t("jobs.empty.title")} description={t("jobs.empty.description")} />
        ) : (
          <>
            <div className="hidden md:block">
              <Table aria-label={t("jobs.tableLabel")}>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">{t("jobs.columns.job")}</TableHead>
                    <TableHead scope="col">{t("jobs.columns.lastRun")}</TableHead>
                    <TableHead scope="col">{t("jobs.columns.outcome")}</TableHead>
                    <TableHead scope="col" className="text-right">{t("jobs.columns.affected")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {status.data.scheduledJobs.map((job) => (
                    <TableRow key={job.name} data-job={job.name}>
                      <TableCell className="font-medium">{jobName(job.name)}</TableCell>
                      <TableCell title={job.lastRunAt ? dates.dateTime(job.lastRunAt) : undefined}>{job.lastRunAt ? dates.relative(job.lastRunAt) : t("jobs.notRun")}</TableCell>
                      <TableCell>{outcome(job)}</TableCell>
                      <TableCell className="text-right tabular-nums">{job.lastRunAt ? fmt(job.lastAffected) : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ul className="divide-y divide-border rounded-2xl border bg-card md:hidden" aria-label={t("jobs.tableLabel")}>
              {status.data.scheduledJobs.map((job) => (
                <li key={job.name} data-job={job.name} className="space-y-1.5 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="min-w-0 font-medium break-words">{jobName(job.name)}</p>
                    {outcome(job)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {job.lastRunAt ? dates.relative(job.lastRunAt) : t("jobs.notRun")}
                    {job.lastRunAt && ` · ${t("jobs.affectedCount", { count: job.lastAffected })}`}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>

      <Section id={`${ids}-counts`} title={t("sections.counts")}>
        {overview.isError ? (
          <ErrorPanel message={t("errors.overview")} retryLabel={t("retry")} onRetry={() => void overview.refetch()} />
        ) : !overview.data ? (
          <div role="status" aria-label={t("loading")} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="h-20 w-full" />)}
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-medium">{t("counts.users")}</h3>
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="counts-users">
                <Stat label={t("counts.total")} value={fmt(overview.data.users.total)} />
                <Stat label={t("counts.active")} value={fmt(overview.data.users.active)} />
                <Stat label={t("counts.disabled")} value={fmt(overview.data.users.disabled)} />
                <Stat label={t("counts.pending")} value={fmt(overview.data.users.pendingVerification)} />
                <Stat label={t("counts.admins")} value={fmt(overview.data.users.admins)} />
              </dl>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-medium">{t("counts.projects")}</h3>
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="counts-projects">
                <Stat label={t("counts.total")} value={fmt(overview.data.projects.total)} />
                <Stat label={t("counts.active")} value={fmt(overview.data.projects.active)} />
                <Stat label={t("counts.archived")} value={fmt(overview.data.projects.archived)} />
              </dl>
            </div>
          </div>
        )}
      </Section>

      <Section id={`${ids}-projects`} title={t("sections.projects")} description={t("projects.description")}>
        {projects.isError && !projects.data ? (
          <ErrorPanel message={t("errors.projects")} retryLabel={t("retry")} onRetry={() => void projects.refetch()} />
        ) : !projects.data ? (
          <div role="status" aria-label={t("loading")} className="space-y-2">
            {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-14 w-full" />)}
          </div>
        ) : projectItems.length === 0 ? (
          <EmptyState title={t("projects.empty.title")} description={t("projects.empty.description")} />
        ) : (
          <div className={projects.isPlaceholderData ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={projects.isPlaceholderData}>
            <div className="hidden md:block">
              <Table aria-label={t("projects.tableLabel")}>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">{t("projects.columns.name")}</TableHead>
                    <TableHead scope="col">{t("projects.columns.status")}</TableHead>
                    <TableHead scope="col" className="text-right">{t("projects.columns.members")}</TableHead>
                    <TableHead scope="col">{t("projects.columns.created")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projectItems.map((project) => (
                    <TableRow key={project.id} data-project-row={project.name}>
                      <TableCell className="max-w-72 truncate font-medium" title={project.name}>{project.name}</TableCell>
                      <TableCell>{projectStatus(project)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(project.activeMembers)}</TableCell>
                      <TableCell>{dates.date(project.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ul className="divide-y divide-border rounded-2xl border bg-card md:hidden" aria-label={t("projects.tableLabel")}>
              {projectItems.map((project) => (
                <li key={project.id} data-project-row={project.name} className="space-y-1.5 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="min-w-0 font-medium break-words">{project.name}</p>
                    {projectStatus(project)}
                  </div>
                  <p className="text-sm text-muted-foreground">{t("projects.membersCount", { count: project.activeMembers })} · {dates.date(project.createdAt)}</p>
                </li>
              ))}
            </ul>
            <PaginationBar page={projectPage} totalPages={Math.max(Math.ceil(projectTotal / PROJECT_PAGE_SIZE), 1)} totalElements={projectTotal} pageSize={PROJECT_PAGE_SIZE} onPageChange={setProjectPage} />
          </div>
        )}
      </Section>
    </div>
  );

  function jobName(name: string) {
    const key = JOB_LABELS[name];
    return key ? t(`jobs.names.${key}`) : name;
  }

  function outcome(job: SystemStatus["scheduledJobs"][number]) {
    if (!job.lastRunAt || !job.lastOutcome) return <ToneBadge tone="neutral">{t("jobs.notRun")}</ToneBadge>;
    return job.lastOutcome === "SUCCESS"
      ? <ToneBadge tone="success">{t("jobs.outcomes.SUCCESS")}</ToneBadge>
      : <ToneBadge tone="danger">{t("jobs.outcomes.FAILURE")}</ToneBadge>;
  }
}

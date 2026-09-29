"use client";

import { useLocale, useTranslations } from "next-intl";
import { CheckCircle, PlusCircle, TrendUp } from "@phosphor-icons/react";
import type { Criterion } from "@/features/criteria/types";

type Activity = { id: string; title: string; at: string; kind: "completed" | "created" };

export function ProjectCriteriaActivity({ criteria }: { criteria: Criterion[] | undefined }) {
  const t = useTranslations("projects.overview");
  const locale = useLocale();
  const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" });
  const activities = criteria?.flatMap((criterion): Activity[] => [
    ...(criterion.completed && criterion.completedAt ? [{ id: `${criterion.id}-completed`, title: criterion.title, at: criterion.completedAt, kind: "completed" as const }] : []),
    ...(criterion.createdAt ? [{ id: `${criterion.id}-created`, title: criterion.title, at: criterion.createdAt, kind: "created" as const }] : []),
  ]).sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 4) ?? [];

  return (
    <section className="workspace-panel min-w-0 p-5" aria-labelledby="overview-activity-heading">
      <h2 id="overview-activity-heading" className="text-base font-semibold">{t("recentCriteriaActivity")}</h2>
      {activities.length ? (
        <ol className="mt-4 space-y-3">
          {activities.map((activity) => (
            <li key={activity.id} className="flex items-start gap-3 text-sm">
              <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${activity.kind === "completed" ? "bg-success/15 text-success" : "bg-primary/15 text-primary"}`}>
                {activity.kind === "completed" ? <CheckCircle size={19} aria-hidden="true" /> : <PlusCircle size={19} aria-hidden="true" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-foreground">{t(activity.kind === "completed" ? "criterionCompleted" : "criterionAdded", { title: activity.title })}</span>
                <time dateTime={activity.at} className="mt-0.5 block text-xs text-muted-foreground">{date.format(new Date(activity.at))}</time>
              </span>
            </li>
          ))}
        </ol>
      ) : <p className="mt-8 text-sm text-muted-foreground">{t("noCriteriaActivity")}</p>}
    </section>
  );
}

export function ProjectCriteriaTrend({ criteria }: { criteria: Criterion[] | undefined }) {
  const t = useTranslations("projects.overview");
  const locale = useLocale();
  const dated = criteria?.filter((criterion) => criterion.completed && criterion.completedAt && Number.isFinite(Date.parse(criterion.completedAt))) ?? [];
  const today = new Date();
  const months = Array.from({ length: 7 }, (_, index) => new Date(today.getFullYear(), today.getMonth() - 6 + index, 1));
  const points = months.map((month, index) => {
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 1).getTime();
    const completed = dated.filter((criterion) => Date.parse(criterion.completedAt!) < end).length;
    const value = criteria?.length ? Math.round(completed / criteria.length * 100) : 0;
    return { x: 48 + index * 84, y: 174 - value * 1.35, value };
  });
  const line = points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
  const area = `${line} L ${points.at(-1)?.x ?? 552} 174 L 48 174 Z`;
  const monthLabel = new Intl.DateTimeFormat(locale, { month: "short" });

  return (
    <section className="workspace-panel min-w-0 p-5" aria-labelledby="overview-trend-heading">
      <div className="flex items-center gap-2">
        <TrendUp size={19} className="text-primary" aria-hidden="true" />
        <h2 id="overview-trend-heading" className="text-base font-semibold">{t("completionTrend")}</h2>
      </div>
      {dated.length ? (
        <div className="mt-4">
          <svg viewBox="0 0 600 210" preserveAspectRatio="none" className="h-40 w-full" role="img" aria-label={t("trendDescription")}>
            <defs><linearGradient id="criteria-trend-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--primary)" stopOpacity=".34" /><stop offset="100%" stopColor="var(--primary)" stopOpacity="0" /></linearGradient></defs>
            {[0, 25, 50, 75, 100].map((value) => {
              const y = 174 - value * 1.35;
              return <g key={value}><line x1="48" x2="552" y1={y} y2={y} stroke="var(--border)" strokeWidth="1" /><text x="3" y={y + 4} fill="var(--muted-foreground)" fontSize="12">{value}%</text></g>;
            })}
            <path d={area} fill="url(#criteria-trend-fill)" />
            <path d={line} fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            {points.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="4" fill="var(--primary)" stroke="var(--card)" strokeWidth="2" />)}
            {months.map((month, index) => <text key={month.toISOString()} x={48 + index * 84} y="199" textAnchor="middle" fill="var(--muted-foreground)" fontSize="12">{monthLabel.format(month)}</text>)}
          </svg>
          <p className="mt-1 text-xs text-muted-foreground">{t("trendNote")}</p>
        </div>
      ) : <p className="mt-8 text-sm text-muted-foreground">{t("noTrend")}</p>}
    </section>
  );
}

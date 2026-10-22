"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle, PlusCircle, TrendUp } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Criterion } from "@/features/criteria/types";
import { buildCriteriaTrend, criterionTimestamp } from "../criteria-trend";

type InsightProps = { criteria: Criterion[] | undefined; error?: string; onRetry?: () => void };
type Activity = { id: string; title: string; at: number; kind: "completed" | "created" };

function InsightQueryState({ error, onRetry }: Pick<InsightProps, "error" | "onRetry">) {
  const t = useTranslations("workspace");
  if (!error) return <Skeleton className="mt-4 h-40 w-full" />;
  return <div className="mt-4 space-y-3"><p role="alert" className="text-sm text-destructive">{error}</p><Button variant="outline" size="sm" onClick={onRetry}>{t("retry")}</Button></div>;
}

export function ProjectCriteriaActivity({ criteria, error, onRetry }: InsightProps) {
  const t = useTranslations("projects.overview");
  const locale = useLocale();
  const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" });
  const now = new Date().getTime();
  const activities = criteria?.flatMap((criterion): Activity[] => {
    const createdAt = criterionTimestamp(criterion.createdAt);
    const completedAt = criterionTimestamp(criterion.completedAt);
    return [
      ...(criterion.completed && createdAt !== null && completedAt !== null && createdAt <= completedAt && completedAt <= now
        ? [{ id: `${criterion.id}-completed`, title: criterion.title, at: completedAt, kind: "completed" as const }] : []),
      ...(createdAt !== null && createdAt <= now
        ? [{ id: `${criterion.id}-created`, title: criterion.title, at: createdAt, kind: "created" as const }] : []),
    ];
  }).sort((a, b) => b.at - a.at).slice(0, 4) ?? [];

  return (
    <section className="workspace-panel min-w-0 p-5" aria-labelledby="overview-activity-heading">
      <h2 id="overview-activity-heading" className="text-base font-semibold">{t("recentCriteriaActivity")}</h2>
      {error || criteria === undefined ? <InsightQueryState error={error} onRetry={onRetry} /> : activities.length ? (
        <ol className="mt-4 space-y-3">
          {activities.map((activity) => (
            <li key={activity.id} className="flex items-start gap-3 text-sm">
              <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${activity.kind === "completed" ? "bg-success/15 text-success" : "bg-primary/15 text-primary"}`}>
                {activity.kind === "completed" ? <CheckCircle size={19} aria-hidden="true" /> : <PlusCircle size={19} aria-hidden="true" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-foreground">{t(activity.kind === "completed" ? "criterionCompleted" : "criterionAdded", { title: activity.title })}</span>
                <time dateTime={new Date(activity.at).toISOString()} className="mt-0.5 block text-xs text-muted-foreground">{date.format(activity.at)}</time>
              </span>
            </li>
          ))}
        </ol>
      ) : <p className="mt-8 text-sm text-muted-foreground">{t("noCriteriaActivity")}</p>}
    </section>
  );
}

export function ProjectCriteriaTrend({ criteria, error, onRetry, onNavigate }: InsightProps & { onNavigate: () => void }) {
  const t = useTranslations("projects.overview");
  const locale = useLocale();
  const chartRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(300);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const fillId = useId();
  const detailsId = useId();
  const trend = buildCriteriaTrend(criteria ?? []);
  const selected = trend.months.find((month) => month.key === selectedKey) ?? trend.months[6];
  const monthLabel = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" });
  const fullMonth = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" });
  const hasCriteria = criteria !== undefined && criteria.length > 0 && !error;

  useEffect(() => {
    const element = chartRef.current;
    if (!element) return;
    const measure = () => setWidth(element.getBoundingClientRect().width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasCriteria]);

  // The SVG uses real rendered pixels: fonts, strokes and round points never stretch.
  const left = 40;
  const right = width - 16;
  const bottom = 160;
  const points = trend.months.map((month, index) => ({
    ...month, x: left + index * (right - left) / 6, y: bottom - month.percentage * 1.4,
  }));
  const line = points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
  const area = `${line} L ${right} ${bottom} L ${left} ${bottom} Z`;
  const targetSize = Math.min(28, Math.max(24, (right - left) / 6 - 2));

  return (
    <section data-testid="criteria-trend" className="workspace-panel min-w-0 p-5" aria-labelledby="overview-trend-heading">
      <div className="flex items-center gap-2">
        <TrendUp size={19} className="text-primary" aria-hidden="true" />
        <h2 id="overview-trend-heading" className="text-base font-semibold">{t("completionTrend")}</h2>
      </div>
      {error || criteria === undefined ? <InsightQueryState error={error} onRetry={onRetry} /> : criteria.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">{t("noTrend")}</p>
      ) : (
        <div className="mt-4 min-w-0">
          <div ref={chartRef} data-testid="criteria-trend-chart" role="group" aria-label={t("trendDescription")} className="relative h-[200px] w-full">
            <svg viewBox={`0 0 ${width} 200`} width={width} height="200" className="block h-full w-full" aria-hidden="true">
              <defs><linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--primary)" stopOpacity=".16" /><stop offset="100%" stopColor="var(--primary)" stopOpacity="0" /></linearGradient></defs>
              {[0, 25, 50, 75, 100].map((value) => {
                const y = bottom - value * 1.4;
                return <g key={value}><line x1={left} x2={right} y1={y} y2={y} stroke="var(--border)" /><text x="0" y={y + 4} fill="var(--muted-foreground)" fontSize="12">{value}%</text></g>;
              })}
              <path d={area} fill={`url(#${fillId})`} />
              <path d={line} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              {points.map((point, index) => (width >= 440 || index % 2 === 0) && (
                <text key={point.key} x={point.x} y="192" textAnchor="middle" fill="var(--muted-foreground)" fontSize="12">{monthLabel.format(point.startsAt)}</text>
              ))}
            </svg>
            {points.map((point) => (
              <button
                key={point.key} type="button" data-testid="criteria-trend-point" data-month={point.key}
                aria-label={t("trendPoint", { month: fullMonth.format(point.startsAt), completed: point.completed, total: trend.total, percentage: point.percentage })}
                aria-pressed={selected.key === point.key} aria-controls={detailsId}
                onClick={() => setSelectedKey(point.key)}
                className="absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-pressed:bg-primary/10"
                style={{ left: point.x, top: point.y, width: targetSize, height: targetSize }}
              ><span aria-hidden="true" className="size-2.5 rounded-full border-2 border-card bg-primary" /></button>
            ))}
          </div>
          <p className="text-xs leading-5 text-muted-foreground">{t("trendNote")}</p>
          {trend.unknownCompletionCount > 0 && <p className="mt-2 text-xs leading-5 text-muted-foreground">{t("trendUnknownDates", { count: trend.unknownCompletionCount })}</p>}
          <div id={detailsId} data-testid="criteria-trend-details" data-month={selected.key} className="mt-4 border-t pt-4" aria-live="polite" aria-atomic="true">
            <h3 className="text-sm font-semibold">{fullMonth.format(selected.startsAt)}</h3>
            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-3 text-sm">
              <div><dt className="text-xs text-muted-foreground">{t(selected.isCurrent ? "trendCurrentCompleted" : "trendCumulativeCompleted")}</dt><dd className="mt-1 font-medium tabular-nums">{t("progressCount", { completed: selected.completed, total: trend.total })}</dd></div>
              <div><dt className="text-xs text-muted-foreground">{t("trendPercentage")}</dt><dd className="mt-1 font-medium tabular-nums">{selected.percentage}%</dd></div>
            </dl>
            <h4 className="mt-4 text-xs font-medium text-muted-foreground">{t("trendMonthlyCompleted", { count: selected.monthlyCriteria.length })}</h4>
            {selected.monthlyCriteria.length ? <ul className="mt-2 space-y-1.5 text-sm">{selected.monthlyCriteria.map((criterion) => <li key={criterion.id} className="break-words">{criterion.title}</li>)}</ul>
              : <p className="mt-2 text-sm text-muted-foreground">{t("trendNoMonthlyCriteria")}</p>}
            <Button variant="outline" size="sm" className="mt-4" onClick={onNavigate}>{t("trendViewCriteria")}</Button>
          </div>
        </div>
      )}
    </section>
  );
}

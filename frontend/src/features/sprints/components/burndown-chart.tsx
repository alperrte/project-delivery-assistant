"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useTaskFormat } from "@/features/tasks/format";
import { addDays, daysBetween, sprintLength } from "../dates";
import type { BurndownPoint, Sprint } from "../types";

export type BurndownUnit = "points" | "tasks";

const HEIGHT = 224;
const MARGIN = { top: 12, right: 14, bottom: 30, left: 34 };
const GRID_LINES = 4;

/** Chart width follows its container so the text keeps its real size on a phone instead of shrinking with a viewBox. */
function useWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(Math.round(entry.contentRect.width), 240)));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

/**
 * Remaining work per day against the straight line from the full scope to zero.
 * Plain SVG, no chart library; a hidden table carries the same numbers for screen readers.
 */
export function BurndownChart({ sprint, points, totalPoints, totalTasks, unit }: { sprint: Sprint; points: BurndownPoint[]; totalPoints: number; totalTasks: number; unit: BurndownUnit }) {
  const t = useTranslations("sprints.burndown");
  const format = useTaskFormat();
  const [ref, width] = useWidth();

  const days = Math.max(sprintLength(sprint.startDate, sprint.endDate), 2);
  const total = unit === "points" ? totalPoints : totalTasks;
  const value = (point: BurndownPoint) => (unit === "points" ? point.remainingPoints : point.remainingTasks);

  const series = points
    .map((point) => ({ point, index: Math.min(Math.max(daysBetween(sprint.startDate, point.date), 0), days - 1) }))
    .sort((a, b) => a.index - b.index);

  const peak = Math.max(total, ...series.map(({ point }) => value(point)), 1);
  const step = Math.ceil(peak / GRID_LINES);
  const yMax = step * GRID_LINES;

  const innerWidth = width - MARGIN.left - MARGIN.right;
  const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const x = (index: number) => MARGIN.left + (index / (days - 1)) * innerWidth;
  const y = (amount: number) => MARGIN.top + (1 - amount / yMax) * innerHeight;

  const actual = series.map(({ point, index }) => `${x(index).toFixed(1)},${y(value(point)).toFixed(1)}`).join(" ");
  const ideal = `${x(0).toFixed(1)},${y(total).toFixed(1)} ${x(days - 1).toFixed(1)},${y(0).toFixed(1)}`;
  const unitLabel = t(`units.${unit}`);
  const labelIndexes = days > 6 ? [0, Math.round((days - 1) / 2), days - 1] : [0, days - 1];
  const dateAt = (index: number) => format.day(series.find((item) => item.index === index)?.point.date ?? addDays(sprint.startDate, index));

  return (
    <div ref={ref} className="w-full">
      <svg role="img" aria-label={t("label", { unit: unitLabel, total })} width={width} height={HEIGHT} className="block max-w-full overflow-visible">
        {Array.from({ length: GRID_LINES + 1 }, (_, line) => {
          const amount = step * line;
          return (
            <g key={line}>
              <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(amount)} y2={y(amount)} className="stroke-border" strokeWidth={1} />
              <text x={MARGIN.left - 8} y={y(amount)} textAnchor="end" dominantBaseline="middle" className="fill-muted-foreground text-[11px] tabular-nums">
                {amount}
              </text>
            </g>
          );
        })}

        {labelIndexes.map((index, position) => (
          <text
            key={index}
            x={x(index)}
            y={HEIGHT - 8}
            textAnchor={position === 0 ? "start" : position === labelIndexes.length - 1 ? "end" : "middle"}
            className="fill-muted-foreground text-[11px]"
          >
            {dateAt(index)}
          </text>
        ))}

        <polyline points={ideal} fill="none" className="stroke-muted-foreground" strokeWidth={1.5} strokeDasharray="5 4" />
        {series.length > 0 && <polyline points={actual} fill="none" className="stroke-primary" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
        {series.length > 0 && days <= 31 && series.map(({ point, index }) => <circle key={point.date} cx={x(index)} cy={y(value(point))} r={2.5} className="fill-primary" />)}
      </svg>

      <ul className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-hidden="true">
        <li className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full bg-primary" />
          {t("actual")}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="w-4 border-t-2 border-dashed border-muted-foreground" />
          {t("ideal")}
        </li>
      </ul>

      <table className="sr-only">
        <caption>{t("label", { unit: unitLabel, total })}</caption>
        <thead>
          <tr>
            <th scope="col">{t("date")}</th>
            <th scope="col">{t("remaining", { unit: unitLabel })}</th>
          </tr>
        </thead>
        <tbody>
          {series.map(({ point }) => (
            <tr key={point.date}>
              <th scope="row">{format.day(point.date)}</th>
              <td>{value(point)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

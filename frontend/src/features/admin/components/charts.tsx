"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

export type DayPoint = { date: string; value: number };

const HEIGHT = 208;
const MARGIN = { top: 12, right: 12, bottom: 28, left: 36 };
const GRID_LINES = 4;

/** Chart width follows its container so text keeps its real size on a phone (same approach as the burndown chart). */
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

/** A calendar day as text; noon avoids any time-zone shift of a plain date. */
function useDayFormat() {
  const locale = useLocale();
  const short = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  const long = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const at = (date: string) => new Date(`${date}T12:00:00`);
  return { short: (date: string) => short.format(at(date)), long: (date: string) => long.format(at(date)) };
}

/**
 * Daily values as a line or as bars. Plain SVG (no chart library); a hidden table carries the same numbers for screen
 * readers, and the chart itself is described by a label with the total.
 */
export function DailyChart({ kind, points, label }: { kind: "line" | "bar"; points: DayPoint[]; label: string }) {
  const t = useTranslations("admin.analytics.chart");
  const format = useDayFormat();
  const [ref, width] = useWidth();

  const total = points.reduce((sum, point) => sum + point.value, 0);
  const peak = Math.max(...points.map((point) => point.value), 1);
  const step = Math.ceil(peak / GRID_LINES);
  const yMax = step * GRID_LINES;

  const innerWidth = width - MARGIN.left - MARGIN.right;
  const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const count = Math.max(points.length, 1);
  const slot = innerWidth / count;
  const x = (index: number) => MARGIN.left + (kind === "bar" ? slot * index + slot / 2 : count === 1 ? innerWidth / 2 : (index / (count - 1)) * innerWidth) ;
  const y = (value: number) => MARGIN.top + (1 - value / yMax) * innerHeight;
  const barWidth = Math.max(Math.min(slot * 0.7, 28), 1);

  const labelIndexes = count > 6 ? [0, Math.round((count - 1) / 2), count - 1] : points.map((_, index) => index);
  const summary = t("summary", { label, total });

  return (
    <div ref={ref} className="w-full">
      {total === 0 && <p className="mb-2 text-sm text-muted-foreground">{t("empty")}</p>}
      <svg role="img" aria-label={summary} width={width} height={HEIGHT} className="block max-w-full overflow-visible">
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
            {format.short(points[index].date)}
          </text>
        ))}
        {kind === "bar"
          ? points.map((point, index) => (
              <rect key={point.date} x={x(index) - barWidth / 2} y={y(point.value)} width={barWidth} height={Math.max(innerHeight - (y(point.value) - MARGIN.top), 0)} rx={barWidth > 4 ? 2 : 0} className="fill-primary">
                <title>{`${format.long(point.date)}: ${point.value}`}</title>
              </rect>
            ))
          : (
            <>
              <polyline points={points.map((point, index) => `${x(index).toFixed(1)},${y(point.value).toFixed(1)}`).join(" ")} fill="none" className="stroke-primary" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {points.length <= 31 && points.map((point, index) => (
                <circle key={point.date} cx={x(index)} cy={y(point.value)} r={2.5} className="fill-primary"><title>{`${format.long(point.date)}: ${point.value}`}</title></circle>
              ))}
            </>
          )}
      </svg>
      <table className="sr-only">
        <caption>{summary}</caption>
        <thead>
          <tr>
            <th scope="col">{t("date")}</th>
            <th scope="col">{label}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.date}>
              <th scope="row">{format.long(point.date)}</th>
              <td>{point.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

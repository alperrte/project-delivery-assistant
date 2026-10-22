import type { Criterion } from "@/features/criteria/types";
import { sortCriteriaForDisplay } from "@/features/criteria/ordering";

/** API instants include an explicit zone. Reject rollover dates and local-time guesses. */
export function criterionTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!parts) return null;
  const [, year, month, day, hour, minute, second] = parts.map(Number);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (month < 1 || month > 12 || day < 1 || day > days || hour > 23 || minute > 59 || second > 59) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export type CriteriaTrendMonth = {
  key: string;
  startsAt: number;
  completed: number;
  monthlyCriteria: Criterion[];
  percentage: number;
  isCurrent: boolean;
};

/** A projection of today's criteria and latest completion dates, never an audit history. */
export function buildCriteriaTrend(criteria: readonly Criterion[], now = new Date()) {
  const nowAt = now.getTime();
  const total = criteria.length;
  const completedCriteria = sortCriteriaForDisplay(criteria.filter((criterion) => criterion.completed));
  const dated = completedCriteria.flatMap((criterion) => {
    const createdAt = criterionTimestamp(criterion.createdAt);
    const completedAt = criterionTimestamp(criterion.completedAt);
    return createdAt !== null && completedAt !== null && createdAt <= completedAt && completedAt <= nowAt
      ? [{ criterion, completedAt }] : [];
  });
  const months: CriteriaTrendMonth[] = Array.from({ length: 7 }, (_, index) => {
    const startsAt = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 6 + index, 1);
    const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + index, 1);
    const isCurrent = index === 6;
    const completed = isCurrent ? completedCriteria.length : dated.filter((item) => item.completedAt < end).length;
    return {
      key: new Date(startsAt).toISOString().slice(0, 7), startsAt, isCurrent, completed,
      monthlyCriteria: dated.filter((item) => item.completedAt >= startsAt && item.completedAt < end).map((item) => item.criterion),
      percentage: total ? Math.round(completed / total * 100) : 0,
    };
  });
  return { total, completed: completedCriteria.length, unknownCompletionCount: completedCriteria.length - dated.length, months };
}

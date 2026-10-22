/**
 * Planned time of a meeting. The pickers edit a local calendar day and clock time (`YYYY-MM-DDTHH:mm` in the viewer's time zone);
 * the backend receives instants (`startsAt`, `endsAt`) plus the IANA `zoneId`. These helpers are pure so the DST and midnight rules
 * can be checked without a browser UI.
 */
const DAY = 86_400_000;

/** An instant as the viewer's local `YYYY-MM-DDTHH:mm`. */
export function localDateTime(value: string): string {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
/** A local `YYYY-MM-DDTHH:mm` value as the separate calendar day and clock time the shared pickers edit. */
export const splitLocal = (value: string) => ({ date: value.slice(0, 10), time: value.slice(11, 16) });
export const joinLocal = ({ date, time }: { date: string; time: string }) => date && time ? `${date}T${time}` : "";

export type ScheduleProblem = "incomplete" | "nonexistent" | "endBeforeStart" | "tooLong" | "past";

/**
 * The one rule set for the planned time, used live under the fields and again on submit. A local time that does not exist (the
 * hour skipped by a DST change) is rejected instead of silently moving to the next hour; an ambiguous one (the repeated hour)
 * resolves to its first occurrence like the browser does. A meeting may cross local midnight and lasts at most 24 hours.
 */
export function scheduleProblem(startsAt: string, endsAt: string, immediate: boolean, now = Date.now()): ScheduleProblem | null {
  const start = immediate ? new Date(now) : new Date(startsAt), end = new Date(endsAt);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return "incomplete";
  if ((!immediate && localDateTime(start.toISOString()) !== startsAt) || localDateTime(end.toISOString()) !== endsAt) return "nonexistent";
  if (end <= start) return "endBeforeStart";
  if (end.getTime() - start.getTime() > DAY) return "tooLong";
  if (!immediate && start.getTime() < now) return "past";
  return null;
}

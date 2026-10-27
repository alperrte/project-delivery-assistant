import type { Meeting, MeetingStatus } from "./types";

/** URL-addressable state of the meeting list. Anything unknown in the URL falls back to the safe default. */
export const STATUS_FILTERS = ["SCHEDULED", "OPEN", "ENDED", "CANCELLED"] as const satisfies readonly MeetingStatus[];
export const SORTS = ["upcoming", "newest", "oldest"] as const;
export type MeetingSort = (typeof SORTS)[number];
export const PAGE_SIZE = 10;

export const statusFromParam = (value: string | null): MeetingStatus | "" => (STATUS_FILTERS as readonly string[]).includes(value ?? "") ? value as MeetingStatus : "";
export const sortFromParam = (value: string | null): MeetingSort => (SORTS as readonly string[]).includes(value ?? "") ? value as MeetingSort : "upcoming";
/** Which kind of meeting the list shows. Filtering only narrows what the viewer already may see; it never widens access. */
export const KIND_FILTERS = ["project", "independent"] as const;
export type MeetingKindFilter = (typeof KIND_FILTERS)[number] | "";
export const kindFromParam = (value: string | null): MeetingKindFilter => (KIND_FILTERS as readonly string[]).includes(value ?? "") ? value as MeetingKindFilter : "";
/** The kind filter, and for project meetings optionally one project (a meeting whose project the viewer cannot see never matches a project). */
export function matchesKind(meeting: Pick<Meeting, "meetingType" | "project">, kind: MeetingKindFilter, projectId: string): boolean {
  if (kind === "independent") return meeting.meetingType === "INDEPENDENT";
  if (kind === "project") return meeting.meetingType === "PROJECT" && (!projectId || meeting.project?.id === projectId);
  return true;
}
/** The distinct projects of the meetings the viewer can see (the project filter offers nothing else), by name. */
export function projectsOf(meetings: readonly Pick<Meeting, "project">[]): NonNullable<Meeting["project"]>[] {
  const found = new Map<string, NonNullable<Meeting["project"]>>();
  for (const meeting of meetings) if (meeting.project) found.set(meeting.project.id, meeting.project);
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** `?page=` is one based in the URL, zero based here. */
export function pageFromParam(value: string | null): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 1 ? parsed - 1 : 0;
}

export type MeetingGroupKey = "today" | "tomorrow" | "later" | "pastWeek" | "earlier";
const GROUP_ORDER: Record<MeetingSort, MeetingGroupKey[]> = {
  upcoming: ["today", "tomorrow", "later", "pastWeek", "earlier"],
  newest: ["later", "tomorrow", "today", "pastWeek", "earlier"],
  oldest: ["earlier", "pastWeek", "today", "tomorrow", "later"],
};

/** Whole calendar days from `now` to `value` in the viewer's time zone (UTC arithmetic on the local date, so a DST change cannot shift it). */
export function dayDifference(value: string | number | Date, now: number | Date): number {
  const a = new Date(value), b = new Date(now);
  return Math.round((Date.UTC(a.getFullYear(), a.getMonth(), a.getDate()) - Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())) / 86_400_000);
}

/** The one group a meeting belongs to. A meeting that is live now is part of today even when it started earlier. */
export function groupKey(meeting: Pick<Meeting, "startsAt" | "status">, now: number): MeetingGroupKey {
  if (meeting.status === "OPEN") return "today";
  const days = dayDifference(meeting.startsAt, now);
  return days === 0 ? "today" : days === 1 ? "tomorrow" : days > 1 ? "later" : days >= -7 ? "pastWeek" : "earlier";
}

/** Case-insensitive match on title, description, agenda items and the name of the (visible) project. */
export function matchesQuery(meeting: Meeting, query: string, locale?: string): boolean {
  const needle = query.trim().toLocaleLowerCase(locale);
  if (!needle) return true;
  return [meeting.title, meeting.description, meeting.project?.name, ...meeting.agenda].some(text => (text ?? "").toLocaleLowerCase(locale).includes(needle));
}

/**
 * Groups first, then orders the groups and the meetings inside them, so every meeting appears exactly once and the
 * groups stay contiguous whatever the sort. The result is the flat order that pagination slices.
 */
export function arrangeMeetings(meetings: Meeting[], sort: MeetingSort, now: number): Meeting[] {
  const buckets = new Map<MeetingGroupKey, Meeting[]>(GROUP_ORDER[sort].map(key => [key, []]));
  meetings.forEach(meeting => buckets.get(groupKey(meeting, now))!.push(meeting));
  const byStart = (a: Meeting, b: Meeting) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.id.localeCompare(b.id);
  const ascending = (key: MeetingGroupKey) => sort === "oldest" || (sort === "upcoming" && (key === "today" || key === "tomorrow" || key === "later"));
  return GROUP_ORDER[sort].flatMap(key => buckets.get(key)!.sort((a, b) => ascending(key) ? byStart(a, b) : byStart(b, a)));
}

/** Consecutive runs of one group inside an already arranged slice. */
export function sliceGroups(meetings: Meeting[], now: number): { key: MeetingGroupKey; meetings: Meeting[] }[] {
  const groups: { key: MeetingGroupKey; meetings: Meeting[] }[] = [];
  for (const meeting of meetings) {
    const key = groupKey(meeting, now), last = groups.at(-1);
    if (last?.key === key) last.meetings.push(meeting); else groups.push({ key, meetings: [meeting] });
  }
  return groups;
}

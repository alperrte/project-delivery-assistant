import { dateFromKey, dateKeyOf } from "@/features/reminders/dates";

/**
 * A task deadline is an instant on the wire (ISO-8601) but two plain fields in the form (a local date and a local
 * time). These helpers are the only place the two are converted, always in the viewer's own timezone.
 */

/** Time of day used when the user picks a deadline date and leaves the time empty. */
export const DEFAULT_DEADLINE_TIME = "23:59";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** `2026-10-03` + `18:00` (local) -> ISO instant. A missing time falls back to {@link DEFAULT_DEADLINE_TIME}. */
export function toDeadlineIso(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = (/^\d{2}:\d{2}$/.test(time) ? time : DEFAULT_DEADLINE_TIME).split(":").map(Number);
  const local = new Date(year, month - 1, day, hours, minutes, 0, 0);
  return Number.isNaN(local.getTime()) ? null : local.toISOString();
}

/** ISO instant -> the local date and time the form inputs show. */
export function fromDeadlineIso(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return { date: "", time: "" };
  return { date: dateKeyOf(value), time: `${pad(value.getHours())}:${pad(value.getMinutes())}` };
}

export type QuickDeadline = "today" | "tomorrow" | "friday" | "nextWeek";

/** Presets of the deadline field; they all land on 18:00 local time. */
export function quickDeadline(kind: QuickDeadline, now: Date = new Date()): { date: string; time: string } {
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (kind) {
    case "tomorrow":
      target.setDate(target.getDate() + 1);
      break;
    case "friday": {
      // The coming Friday; on a Friday that is the same day, so "Friday" never silently means a week from now.
      target.setDate(target.getDate() + ((5 - target.getDay() + 7) % 7));
      break;
    }
    case "nextWeek":
      target.setDate(target.getDate() + 7);
      break;
    case "today":
    default:
      break;
  }
  return { date: dateKeyOf(target), time: "18:00" };
}

export type DeadlineState = "overdue" | "soon" | "upcoming";

/** `soon` means within 24 hours, the same window the backend uses for its reminder. */
export function deadlineState(iso: string, now: Date = new Date()): DeadlineState {
  const diff = new Date(iso).getTime() - now.getTime();
  if (diff < 0) return "overdue";
  return diff <= DAY_MS ? "soon" : "upcoming";
}

export type Countdown = { unit: "minutes" | "hours" | "days"; value: number; past: boolean };

/** Whole units until (or since) the deadline, rounded down, never below 1 so "0 minutes left" does not show. */
export function countdown(iso: string, now: Date = new Date()): Countdown {
  const diff = new Date(iso).getTime() - now.getTime();
  const past = diff < 0;
  const abs = Math.abs(diff);
  if (abs < HOUR_MS) return { unit: "minutes", value: Math.max(1, Math.floor(abs / 60_000)), past };
  if (abs < DAY_MS) return { unit: "hours", value: Math.floor(abs / HOUR_MS), past };
  return { unit: "days", value: Math.floor(abs / DAY_MS), past };
}

export type DeadlineBucket = "overdue" | "today" | "week" | "later" | "none";

/** Görevlerim grouping: calendar days in the viewer's timezone, not 24 hour windows. */
export function deadlineBucket(iso: string | null, now: Date = new Date()): DeadlineBucket {
  if (!iso) return "none";
  const value = new Date(iso);
  if (value.getTime() < now.getTime()) return "overdue";
  const today = dateFromKey(dateKeyOf(now));
  const day = dateFromKey(dateKeyOf(value));
  const days = Math.round((day.getTime() - today.getTime()) / DAY_MS);
  if (days <= 0) return "today";
  return days <= 6 ? "week" : "later";
}

/** Minutes -> `1s 30dk` style parts; the caller formats them with its own unit labels. */
export function splitMinutes(total: number): { hours: number; minutes: number } {
  const safe = Math.max(0, Math.round(total));
  return { hours: Math.floor(safe / 60), minutes: safe % 60 };
}

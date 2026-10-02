import { dateFromKey, dateKeyOf, todayKey } from "@/features/reminders/dates";

const DAY_MS = 86_400_000;

/** Whole days from one `YYYY-MM-DD` key to another; negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((dateFromKey(to).getTime() - dateFromKey(from).getTime()) / DAY_MS);
}

export function addDays(key: string, days: number): string {
  const date = dateFromKey(key);
  date.setDate(date.getDate() + days);
  return dateKeyOf(date);
}

/** Calendar days in the sprint, both ends included. */
export const sprintLength = (startDate: string, endDate: string) => daysBetween(startDate, endDate) + 1;

/** Days until the sprint ends (0 on the last day, negative once it is over). */
export const daysLeft = (endDate: string, today: string = todayKey()) => daysBetween(today, endDate);

export const percent = (done: number, total: number) => (total > 0 ? Math.round((done / total) * 100) : 0);

/** Date and time labels of the chat, all through `Intl` in the interface language. */

function dateOf(iso: string): Date {
  return new Date(iso);
}

/** `14:05`: the time of a message. */
export function formatClock(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(dateOf(iso));
}

/** Local calendar day of a timestamp, to put a separator where the day changes. */
export function dayKey(iso: string): string {
  const date = dateOf(iso);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** "Today", "Yesterday", or the full date. */
export function formatDayLabel(iso: string, locale: string, labels: { today: string; yesterday: string }, now = new Date()): string {
  const date = dateOf(iso);
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (days === 0) return labels.today;
  if (days === 1) return labels.yesterday;
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(date);
}

/** The time of today's messages, a short date for older ones: the right-hand label of a conversation row. */
export function formatListTime(iso: string, locale: string, now = new Date()): string {
  const date = dateOf(iso);
  if (startOfDay(now) === startOfDay(date)) return formatClock(iso, locale);
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(date);
}

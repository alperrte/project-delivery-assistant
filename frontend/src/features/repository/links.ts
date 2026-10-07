const DIVISIONS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 60 * 60 * 24 * 365],
  ["month", 60 * 60 * 24 * 30],
  ["week", 60 * 60 * 24 * 7],
  ["day", 60 * 60 * 24],
  ["hour", 60 * 60],
  ["minute", 60],
];

export function relativeTime(iso: string, locale: string): string {
  const seconds = (Date.parse(iso) - Date.now()) / 1000;
  if (!Number.isFinite(seconds)) return "";
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  for (const [unit, secondsInUnit] of DIVISIONS) {
    if (Math.abs(seconds) >= secondsInUnit) {
      return formatter.format(Math.round(seconds / secondsInUnit), unit);
    }
  }
  return formatter.format(Math.round(seconds), "second");
}

/** Only real GitHub commit/repository pages are linked; anything else in an API answer is shown as plain text. */
export function safeGitHubLink(url: string | null | undefined): string | null {
  return url && /^https:\/\/github\.com\//.test(url) ? url : null;
}

/** GitHub avatars only; any other host falls back to the initials of `Avatar`. */
export function safeAvatarSrc(url: string | null | undefined): string | null {
  return url && /^https:\/\/avatars\.githubusercontent\.com\//.test(url) ? url : null;
}

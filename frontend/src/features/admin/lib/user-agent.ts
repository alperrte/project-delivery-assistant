export type DeviceSummary = { browser: string | null; os: string | null };

// Order matters: Edge and Opera also say "Chrome", Chrome also says "Safari".
const BROWSERS: [name: string, pattern: RegExp][] = [
  ["Edge", /\bEdg(?:e|A|iOS)?\/(\d+)/],
  ["Opera", /\bOPR\/(\d+)/],
  ["Firefox", /\b(?:Firefox|FxiOS)\/(\d+)/],
  ["Chrome", /\b(?:Chrome|CriOS|HeadlessChrome)\/(\d+)/],
  ["Safari", /\bVersion\/(\d+).*Safari\//],
];

const SYSTEMS: [name: string, pattern: RegExp][] = [
  ["Windows", /Windows NT/],
  ["Android", /Android/],
  ["iOS", /iPhone|iPad|iPod/],
  ["macOS", /Mac OS X|Macintosh/],
  ["ChromeOS", /CrOS/],
  ["Linux", /Linux|X11/],
];

/**
 * A short, readable summary of a browser's own `User-Agent` text ("Chrome 127 · Windows"). It only recognizes
 * well-known product tokens; anything else is unknown and the caller keeps the raw text as a tooltip. The text comes
 * from the client, so it is matched and displayed as text only.
 */
export function summarizeUserAgent(userAgent: string | null | undefined): DeviceSummary {
  const ua = (userAgent ?? "").slice(0, 400);
  if (!ua) return { browser: null, os: null };
  let browser: string | null = /^curl\//i.test(ua) ? "curl" : null;
  for (const [name, pattern] of BROWSERS) {
    const match = pattern.exec(ua);
    if (match) {
      browser = `${name} ${match[1]}`;
      break;
    }
  }
  const os = SYSTEMS.find(([, pattern]) => pattern.test(ua))?.[0] ?? null;
  return { browser, os };
}

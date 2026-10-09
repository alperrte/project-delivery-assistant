/**
 * The one place that defines what a cookie/analytics consent decision is. Consent is a choice of this browser (device),
 * not of an account: it is kept in `localStorage` and is not changed by signing in or out.
 */

/** Raise this when the cookie or analytics practice changes in a way that needs a fresh decision. */
export const CONSENT_VERSION = 1;

export const CONSENT_STORAGE_KEY = "pda:cookie-consent";
export const CONSENT_CHANGE_EVENT = "pda:cookie-consent-changed";

/** The categories a person can decide on. "necessary" is always on and cannot be switched off. */
export const CONSENT_CATEGORIES = ["necessary", "analytics"] as const;
export type ConsentCategory = (typeof CONSENT_CATEGORIES)[number];

/** Browser storage written only on behalf of the analytics category: it exists only after consent and is removed on withdrawal. */
export const ANALYTICS_VISITOR_KEY = "pda:analytics-visitor";
export const ANALYTICS_SESSION_KEY = "pda:analytics-session";

export type ConsentRecord = {
  version: number;
  necessary: true;
  analytics: boolean;
  /** ISO timestamp of the decision. */
  updatedAt: string;
};

export function createConsentRecord(analytics: boolean, now: Date = new Date()): ConsentRecord {
  return { version: CONSENT_VERSION, necessary: true, analytics, updatedAt: now.toISOString() };
}

/**
 * Parses what is in storage. Anything that is not a well-formed record of the current version counts as "no decision",
 * so the banner asks again and analytics stays off.
 */
export function parseConsent(raw: string | null | undefined): ConsentRecord | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    const record = value as Record<string, unknown>;
    if (record.version !== CONSENT_VERSION) return null;
    if (typeof record.analytics !== "boolean") return null;
    if (typeof record.updatedAt !== "string") return null;
    return { version: CONSENT_VERSION, necessary: true, analytics: record.analytics, updatedAt: record.updatedAt };
  } catch {
    return null;
  }
}

// Used when storage is unavailable (private mode, blocked): a decision still holds until the tab closes.
let memoryRaw: string | null = null;

export function readRawConsent(): string | null {
  try {
    return localStorage.getItem(CONSENT_STORAGE_KEY) ?? memoryRaw;
  } catch {
    return memoryRaw;
  }
}

export function writeRawConsent(raw: string) {
  memoryRaw = raw;
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, raw);
  } catch {
    /* kept in memory for this tab only */
  }
}

/** The current decision, read fresh from storage. `null` means the person has not decided (or must decide again). */
export function readConsent(): ConsentRecord | null {
  return parseConsent(readRawConsent());
}

/** Default deny: analytics is on only for an explicit, current, positive decision. */
export function analyticsAllowed(): boolean {
  return readConsent()?.analytics === true;
}

/** Removes every identifier that exists only for analytics. Called on withdrawal and whenever analytics is not allowed. */
export function purgeAnalyticsStorage() {
  for (const key of [ANALYTICS_VISITOR_KEY, ANALYTICS_SESSION_KEY]) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* nothing stored, or storage is blocked */
    }
  }
}

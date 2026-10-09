import { CONSENT_STORAGE_KEY, createConsentRecord } from "../src/features/consent/contract";

const ORIGIN = process.env.E2E_BASE_URL ?? "http://localhost:3000";

/**
 * Playwright storage state of a visitor who already rejected analytics. Every spec that is not about the cookie
 * banner itself starts from it, so the banner never covers the page under test and no analytics request is ever
 * made by accident. Specs about consent start from {@link FRESH_VISITOR} instead.
 */
export const REJECTED_STATE = {
  cookies: [],
  origins: [{
    origin: new URL(ORIGIN).origin,
    localStorage: [{ name: CONSENT_STORAGE_KEY, value: JSON.stringify(createConsentRecord(false, new Date("2026-10-09T00:00:00Z"))) }],
  }],
};

export const FRESH_VISITOR = { cookies: [], origins: [] };

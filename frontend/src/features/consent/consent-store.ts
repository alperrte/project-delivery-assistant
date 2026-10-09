"use client";

import { useSyncExternalStore } from "react";
import {
  CONSENT_CHANGE_EVENT,
  CONSENT_STORAGE_KEY,
  createConsentRecord,
  parseConsent,
  purgeAnalyticsStorage,
  readRawConsent,
  writeRawConsent,
  type ConsentRecord,
} from "./contract";

/** The server and the first client render use this, so nothing consent-related is drawn before the browser is read. */
const NOT_READ = "pda:consent-not-read";

/**
 * Stores a decision. Turning analytics off also removes every analytics identifier right away; the analytics
 * transport reads the decision again before each request, so nothing more is sent after this returns.
 */
export function saveConsent(analytics: boolean) {
  writeRawConsent(JSON.stringify(createConsentRecord(analytics)));
  if (!analytics) purgeAnalyticsStorage();
  window.dispatchEvent(new Event(CONSENT_CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === CONSENT_STORAGE_KEY) onChange();
  };
  window.addEventListener(CONSENT_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CONSENT_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export type ConsentState = {
  /** False until the browser has been read (server render and hydration). */
  ready: boolean;
  /** True when there is a current decision. */
  decided: boolean;
  analytics: boolean;
  record: ConsentRecord | null;
};

const SERVER_STATE: ConsentState = { ready: false, decided: false, analytics: false, record: null };

export function useConsent(): ConsentState {
  const raw = useSyncExternalStore(subscribe, readRawConsent, () => NOT_READ);
  if (raw === NOT_READ) return SERVER_STATE;
  const record = parseConsent(raw);
  return { ready: true, decided: record !== null, analytics: record?.analytics === true, record };
}

/** Subscribe to every change of the decision (this tab and other tabs). */
export function subscribeToConsent(onChange: () => void) {
  return subscribe(onChange);
}

// The preferences dialog can be opened from the banner, the footer, the account menu and the policy page.
let preferencesOpen = false;
const preferencesListeners = new Set<() => void>();

function setPreferencesOpen(next: boolean) {
  if (preferencesOpen === next) return;
  preferencesOpen = next;
  preferencesListeners.forEach((listener) => listener());
}

export function openConsentPreferences() {
  setPreferencesOpen(true);
}

export function closeConsentPreferences() {
  setPreferencesOpen(false);
}

export function usePreferencesOpen() {
  return useSyncExternalStore(
    (onChange) => {
      preferencesListeners.add(onChange);
      return () => preferencesListeners.delete(onChange);
    },
    () => preferencesOpen,
    () => false,
  );
}

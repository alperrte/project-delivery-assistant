import { ANALYTICS_SESSION_KEY, ANALYTICS_VISITOR_KEY, analyticsAllowed } from "@/features/consent/contract";

/** A session ends after this long without any analytics activity; the next event starts a new one. */
export const SESSION_IDLE_MS = 30 * 60 * 1000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function randomId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // Not a secure context (plain http on a LAN address): build a version 4 id from random bytes instead.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function readString(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readJson(key: string): unknown {
  try {
    const raw = readString(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage blocked: the identifier then lives only as long as the page (see memory below) */
  }
}

// Storage can be unavailable even when analytics is allowed; identifiers then stay in memory for this page only.
let memoryVisitor: string | null = null;
let memorySession: { id: string; lastActive: number } | null = null;

export type AnalyticsIdentity = { visitorId: string; sessionId: string };

/**
 * The anonymous identifiers, created on demand. They are random, belong to this browser only, and are never made
 * unless analytics is allowed right now: with consent off this returns `null` and creates nothing.
 */
export function ensureIdentity(now: number = Date.now()): AnalyticsIdentity | null {
  if (!analyticsAllowed()) return null;

  let visitorId = readString(ANALYTICS_VISITOR_KEY) ?? memoryVisitor;
  if (!visitorId || !UUID.test(visitorId)) {
    visitorId = randomId();
    write(ANALYTICS_VISITOR_KEY, visitorId);
  }
  memoryVisitor = visitorId;

  const stored = readJson(ANALYTICS_SESSION_KEY) as { id?: unknown; lastActive?: unknown } | null;
  let session = stored && typeof stored.id === "string" && UUID.test(stored.id) && typeof stored.lastActive === "number"
    ? { id: stored.id, lastActive: stored.lastActive }
    : memorySession;
  if (!session || now - session.lastActive > SESSION_IDLE_MS) session = { id: randomId(), lastActive: now };
  session = { id: session.id, lastActive: now };
  memorySession = session;
  write(ANALYTICS_SESSION_KEY, JSON.stringify(session));
  return { visitorId, sessionId: session.id };
}

/** Forgets what this page kept in memory (withdrawal); storage is purged by the consent store. */
export function forgetIdentity() {
  memoryVisitor = null;
  memorySession = null;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

/** Fired on `window` when a request is still unauthenticated after the session renewal failed. */
export const SESSION_EXPIRED_EVENT = "pda:session-expired";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code?: string,
    public readonly invalidFields?: Record<string, string>,
    /** The whole ProblemDetail body, for errors that carry extra properties (e.g. `members`). */
    public readonly body?: Record<string, unknown>,
  ) {
    super(code ?? `http_${status}`);
    this.name = "ApiError";
  }

  get isNetwork() {
    return this.status === 0;
  }
}

type CsrfState = { headerName: string } | null;
let csrf: CsrfState = null;
let refreshing: Promise<boolean> | null = null;

/**
 * Header the backend adds to every authenticated response: how many milliseconds the access token stays valid. A
 * duration (not a timestamp) so that a wrong clock in the browser cannot make the session look expired.
 */
const ACCESS_EXPIRES_IN_HEADER = "X-Access-Token-Expires-In";
let accessExpiresAt: number | null = null;

/** When the current access token expires, on this browser's clock, or null if the server has not said yet. */
export function getAccessExpiresAt(): number | null {
  return accessExpiresAt;
}

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

async function ensureCsrf(force = false): Promise<{ headerName: string; token: string }> {
  if (force || !csrf || !readCookie("XSRF-TOKEN")) {
    const res = await fetch(`${API_URL}/auth/csrf`, { credentials: "include" });
    if (!res.ok) throw new ApiError(res.status);
    csrf = (await res.json()) as { headerName: string };
  }
  return { headerName: csrf!.headerName, token: decodeURIComponent(readCookie("XSRF-TOKEN") ?? "") };
}

async function toApiError(res: Response): Promise<ApiError> {
  let body: { code?: string; invalidFields?: Record<string, string> | string[] | { field: string; message: string }[] } & Record<string, unknown> = {};
  try {
    body = await res.json();
  } catch {
    /* body is optional */
  }
  let fields: Record<string, string> | undefined;
  if (Array.isArray(body.invalidFields)) {
    // The server sends the names of the invalid fields (string[]); a {field, message}[] shape is accepted too.
    fields = Object.fromEntries(
      (body.invalidFields as (string | { field: string; message: string })[]).map((f) =>
        typeof f === "string" ? [f, f] : [f.field, f.message],
      ),
    );
  } else if (body.invalidFields) {
    fields = body.invalidFields;
  }
  return new ApiError(res.status, body.code, fields, body);
}

async function send(path: string, init: RequestInit, method: string): Promise<Response> {
  const headers = new Headers(init.headers);
  // FormData must keep the browser-generated multipart boundary, so only JSON bodies get a Content-Type.
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (method !== "GET") {
    const { headerName, token } = await ensureCsrf();
    headers.set(headerName, token);
  }
  try {
    const res = await fetch(`${API_URL}${path}`, { ...init, method, headers, credentials: "include" });
    const header = res.headers.get(ACCESS_EXPIRES_IN_HEADER);
    const remaining = header === null ? NaN : Number(header);
    if (Number.isFinite(remaining) && remaining >= 0) accessExpiresAt = Date.now() + remaining;
    return res;
  } catch {
    throw new ApiError(0);
  }
}

const REFRESH_LOCK = "pda-session-refresh";
const LAST_REFRESH_KEY = "pda:last-session-refresh";
/** A session renewed this recently by any tab is fresh enough: the cookies are shared by all tabs. */
const FRESH_WINDOW_MS = 8_000;

function recentlyRefreshed(): boolean {
  try {
    return Date.now() - Number(localStorage.getItem(LAST_REFRESH_KEY)) < FRESH_WINDOW_MS;
  } catch {
    return false;
  }
}

/**
 * The refresh token rotates on use, and presenting the previous one again ends the whole session. Tabs share the
 * cookies, so two tabs refreshing at the same moment could do exactly that. The Web Locks API (all current browsers)
 * lines them up: the second tab waits, sees that the first one just renewed the session and does not rotate again.
 */
async function exclusivelyAcrossTabs<T>(task: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  return locks ? locks.request(REFRESH_LOCK, task) : task();
}

function refreshSession(): Promise<boolean> {
  refreshing ??= exclusivelyAcrossTabs(async () => {
    if (recentlyRefreshed()) return true;
    const renewed = await send("/auth/refresh", {}, "POST").then((res) => res.ok).catch(() => false);
    if (renewed) {
      try {
        localStorage.setItem(LAST_REFRESH_KEY, String(Date.now()));
      } catch {
        /* storage unavailable: the lock alone still prevents simultaneous rotations */
      }
    }
    return renewed;
  })
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/**
 * Renews the session ahead of time (before the access token runs out) and reads the new expiry. False when the
 * session cannot be renewed (it was ended, or the network is down).
 */
export async function renewAccessSession(): Promise<boolean> {
  if (!(await refreshSession())) return false;
  try {
    // Any authenticated response carries the new token's expiry.
    await apiRequest("/auth/me");
  } catch {
    /* the renewal itself worked; the expiry is simply not updated */
  }
  return true;
}

const NO_REFRESH = ["/auth/login", "/auth/register", "/auth/register/invitation", "/auth/refresh", "/auth/logout"];

export async function apiRequest<T = void>(
  path: string,
  options: { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown } = {},
): Promise<T> {
  const method = options.method ?? "GET";
  const init: RequestInit =
    options.body === undefined
      ? {}
      : { body: options.body instanceof FormData ? options.body : JSON.stringify(options.body) };

  let res = await send(path, init, method);

  if (res.status === 403 && method !== "GET") {
    const err = await toApiError(res.clone());
    if (!err.code) {
      // Most likely a stale CSRF token; fetch a new one and retry once.
      await ensureCsrf(true);
      res = await send(path, init, method);
    }
  }

  if (res.status === 401 && !NO_REFRESH.includes(path)) {
    if (await refreshSession()) {
      res = await send(path, init, method);
    }
    // Still unauthenticated after a renewal attempt: the session is really over (refresh cookie expired or
    // revoked). Tell the app so it can send the user to the login page instead of showing an unrelated error.
    if (res.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
  }

  if (!res.ok) throw await toApiError(res);
  if (res.status === 204 || res.headers.get("content-length") === "0") return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const apiUrl = (path: string) => `${API_URL}${path}`;

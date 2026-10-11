import { ApiError } from "./client";

/** Reads are retried at most this many times (3 attempts in all). */
export const MAX_QUERY_RETRIES = 2;

/**
 * React Query `retry` for GET queries: a request that got no answer (offline blip, timeout) or a gateway/availability
 * status (502, 503, 504) is tried again. A real answer is final: 4xx is the user's or the server's decision, and 500 is a
 * bug that a retry only repeats. Mutations are never retried (a retried POST could run twice).
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_QUERY_RETRIES || !(error instanceof ApiError)) return false;
  if (error.code === "request_not_allowed") return false;
  return error.isNetwork || error.status === 502 || error.status === 503 || error.status === 504;
}

/** Exponential back-off between the retries: 0.5 s, 1 s (cap 4 s). */
export function queryRetryDelay(attempt: number): number {
  return Math.min(500 * 2 ** attempt, 4_000);
}

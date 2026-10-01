import { ApiError } from "./client";

/**
 * Backend `ProblemDetail.code` values that map to a distinct i18n key instead of the
 * coarse per-status fallback below. See `.agents/SECURITY.md` §11 Faz 9 for the source list.
 */
const CODE_KEYS: Record<string, string> = {
  reset_code_invalid: "resetCodeInvalid",
  reset_code_expired: "resetCodeExpired",
  reset_too_many_attempts: "tooManyRequests",
  password_confirmation_mismatch: "passwordMismatch",
  current_password_incorrect: "currentPasswordIncorrect",
  password_unchanged: "passwordUnchanged",
  account_unavailable: "accountUnavailable",
  PROJECT_LOGO_INVALID_TYPE: "PROJECT_LOGO_INVALID_TYPE",
  PROJECT_LOGO_TOO_LARGE: "PROJECT_LOGO_TOO_LARGE",
  PROJECT_LOGO_EMPTY: "PROJECT_LOGO_EMPTY",
};

/** Maps an API failure to a key under the `errors` i18n namespace. */
export function errorKey(err: unknown): string {
  if (!(err instanceof ApiError)) return "generic";
  if (err.isNetwork) return "network";
  if (err.code && CODE_KEYS[err.code]) return CODE_KEYS[err.code];
  switch (err.status) {
    case 400:
      return "invalidFields";
    case 401:
      return "invalidCredentials";
    case 403:
      return "forbidden";
    case 404:
      return "notFound";
    case 409:
      return "conflict";
    case 429:
      return "tooManyRequests";
    case 503:
      return "mailUnavailable";
    default:
      return "generic";
  }
}

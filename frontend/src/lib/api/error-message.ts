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
  REPOSITORY_PRIVATE: "REPOSITORY_PRIVATE",
  REPOSITORY_READ_LIMIT: "tooManyRequests",
  account_unavailable: "accountUnavailable",
  PROJECT_LOGO_INVALID_TYPE: "PROJECT_LOGO_INVALID_TYPE",
  PROJECT_LOGO_TOO_LARGE: "PROJECT_LOGO_TOO_LARGE",
  PROJECT_LOGO_EMPTY: "PROJECT_LOGO_EMPTY",
  ...Object.fromEntries(["INVALID_TYPE", "TOO_LARGE", "EMPTY", "DIMENSIONS", "UNAVAILABLE", "CONFLICT"].map(code => [`ORGANIZATION_MEDIA_${code}`, `ORGANIZATION_MEDIA_${code}`])),
  PROJECT_BANNER_INVALID_TYPE: "PROJECT_BANNER_INVALID_TYPE",
  PROJECT_BANNER_TOO_LARGE: "PROJECT_BANNER_TOO_LARGE",
  PROJECT_BANNER_EMPTY: "PROJECT_BANNER_EMPTY",
  PROJECT_BANNER_DIMENSIONS: "PROJECT_BANNER_DIMENSIONS",
  PROJECT_LOGO_DIMENSIONS: "PROJECT_LOGO_DIMENSIONS",
  PROFILE_PHOTO_INVALID_TYPE: "PROFILE_PHOTO_INVALID_TYPE",
  PROFILE_PHOTO_TOO_LARGE: "PROFILE_PHOTO_TOO_LARGE",
  PROFILE_PHOTO_EMPTY: "PROFILE_PHOTO_EMPTY",
  PROFILE_PHOTO_DIMENSIONS: "PROFILE_PHOTO_DIMENSIONS",
  TEAM_MEMBER_EXISTS: "TEAM_MEMBER_EXISTS",
  TEAM_CIRCULAR_PARENT: "TEAM_CIRCULAR_PARENT",
  TEAM_HAS_CHILDREN: "TEAM_HAS_CHILDREN",
  TEAM_LAST_MEMBERSHIP: "TEAM_LAST_MEMBERSHIP",
  TEAM_ARCHIVE_WOULD_ORPHAN: "TEAM_ARCHIVE_WOULD_ORPHAN",
  PROJECT_OWNER_PROTECTED: "PROJECT_OWNER_PROTECTED",
  LAST_PROJECT_MANAGER: "LAST_PROJECT_MANAGER",
  ...Object.fromEntries(
    [
      "PROJECT_TASK_MODE_NOT_CONFIGURED",
      "TASK_MODE_NOT_ALLOWED",
      "TASK_SIMPLE_FIELDS_INVALID",
      "TASK_MODE_CONVERSION_BLOCKED",
      "TASK_ARCHIVED",
      "PROJECT_ARCHIVED",
      "TASK_INVALID_TRANSITION",
      "TASK_DONE_CANNOT_BLOCK",
      "TASK_DONE_CANNOT_POOL",
      "TASK_ALREADY_CLAIMED",
      "TASK_NOT_RELEASABLE",
      "TASK_NOT_IN_POOL",
      "TASK_POOL_HAS_ASSIGNEE",
      "TASK_POOL_TEAM_ONLY",
      "TASK_POOL_TEAM_INVALID",
      "TASK_RELATION_CYCLE",
      "TASK_RELATION_EXISTS",
      "TASK_ATTACHMENT_TYPE",
      "TASK_ATTACHMENT_INVALID",
      "TASK_ATTACHMENT_TOO_LARGE",
      "TASK_ATTACHMENT_LIMIT",
      "TASK_CHECKLIST_LIMIT",
      "TASK_LABEL_LIMIT",
      "TASK_INVALID_PARENT",
      "TASK_INVALID_ESTIMATE",
      "TASK_DATES_INVALID",
      "TASK_TOO_MANY_ASSIGNEES",
      "TASK_ASSIGNEE_NOT_MEMBER",
      "TASK_TOO_MANY_MENTIONS",
      "TASK_COMMENT_DELETED",
      "TASK_INVALID_REQUEST",
      "SPRINT_ACTIVE_EXISTS",
      "SPRINT_COMPLETED",
      "SPRINT_NOT_EMPTY",
      "SPRINT_INVALID",
      "LABEL_NAME_EXISTS",
      "WORKLOG_INVALID",
      "CHAT_FORBIDDEN",
      "CHAT_NOT_FOUND",
      "CHAT_RECIPIENT",
      "CHAT_SELF",
      "CHAT_MESSAGE_EMPTY",
      "CHAT_MESSAGE_TOO_LONG",
      "CHAT_MESSAGE_INVALID",
      "CHAT_RATE_LIMITED",
      "CHAT_INVALID_REQUEST",
      "CHAT_CONFLICT",
      "CHAT_REPLY_NOT_FOUND",
      "CHAT_REACTION_INVALID",
      "CHAT_REACTION_RATE_LIMITED",
    ].map((code) => [code, code]),
  ),
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

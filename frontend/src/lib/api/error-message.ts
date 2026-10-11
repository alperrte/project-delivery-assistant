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
  REPOSITORY_ADVANCED_REQUIRED: "REPOSITORY_ADVANCED_REQUIRED",
  REPOSITORY_READ_LIMIT: "tooManyRequests",
  account_unavailable: "accountUnavailable",
  email_not_verified: "emailNotVerified",
  verification_code_invalid: "resetCodeInvalid",
  verification_code_expired: "resetCodeExpired",
  verification_too_many_attempts: "tooManyRequests",
  reset_ticket_invalid: "resetTicketInvalid",
  change_code_invalid: "resetCodeInvalid",
  change_code_expired: "resetCodeExpired",
  change_too_many_attempts: "tooManyRequests",
  verification_required: "verificationRequired",
  two_factor_code_invalid: "twoFactorCodeInvalid",
  two_factor_session_expired: "twoFactorSessionExpired",
  two_factor_locked: "twoFactorLocked",
  two_factor_already_enabled: "twoFactorAlreadyEnabled",
  two_factor_required: "twoFactorRequired",
  two_factor_unavailable: "twoFactorUnavailable",
  admin_reauthentication_required: "adminReauthenticationRequired",
  admin_two_factor_required: "adminTwoFactorRequired",
  deletion_link_invalid: "deletionLinkInvalid",
  deletion_link_expired: "deletionLinkExpired",
  deletion_credentials_invalid: "deletionCredentialsInvalid",
  owns_resources: "ownsResources",
  administrator_cannot_delete: "administratorCannotDelete",
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
  INVITATION_ALREADY_PENDING: "invitationAlreadyPending",
  INVITATION_TARGET_ALREADY_MEMBER: "invitationTargetAlreadyMember",
  INVITATION_NOT_PENDING: "invitationNotPending",
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
      "CONTACT_INVALID",
      "CONTACT_DUPLICATE",
      "CONTACT_UNAVAILABLE",
      "CONTACT_DELIVERY_FAILED",
      "ADMIN_SELF_DENIED",
      "ADMIN_LAST_ADMIN",
      "USER_NOT_FOUND",
      "SUPPORT_REQUEST_NOT_FOUND",
    ].map((code) => [code, code]),
  ),
};

/**
 * Same as `errorKey`, for the invitee's own accept action: "the target is already a member" is about the signed-in
 * user there, so it is phrased in the second person instead of the manager-facing "this person".
 */
export function inviteeErrorKey(err: unknown): string {
  if (err instanceof ApiError && err.code === "INVITATION_TARGET_ALREADY_MEMBER") return "invitationSelfAlreadyMember";
  return errorKey(err);
}

/** Maps an API failure to a key under the `errors` i18n namespace. */
export function errorKey(err: unknown): string {
  if (!(err instanceof ApiError)) return "generic";
  if (err.isTimeout) return "timeout";
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

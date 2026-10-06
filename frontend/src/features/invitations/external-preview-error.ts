import {ApiError} from "@/lib/api/client";

export function isInvalidInvitationToken(error:unknown) {
  return error instanceof ApiError && (error.status===404 || (error.status===400 && !!error.invalidFields?.token));
}
export function isPreviewServerFailure(error:unknown) {
  return error instanceof ApiError && error.status>=500;
}

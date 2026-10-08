import { apiRequest, apiUrl } from "@/lib/api/client";
import type { AuthenticatedUser } from "@/features/auth/api";

/** Server-side limit; the client checks the same numbers only to save a round trip. */
export const PROFILE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PROFILE_PHOTO_TYPES = ["image/png", "image/jpeg", "image/webp"];

/**
 * Photo URL for `<img>`. `version` comes with the user (`profilePhotoVersion`) and busts the one-year immutable
 * cache when the photo changes; the URL carries no storage detail, only the user id the page already knows.
 */
export function profilePhotoUrl(userId: string, version: number): string {
  return apiUrl(`/users/${userId}/profile-photo?v=${version}`);
}

/** The `src` for an `Avatar`: the photo URL when the person has one, `null` (initials) otherwise. */
export function profilePhotoSrc(userId: string, version: number | null | undefined): string | null {
  return version == null ? null : profilePhotoUrl(userId, version);
}

export const accountApi = {
  rename: (nickname: string, signal?: AbortSignal) => apiRequest<AuthenticatedUser>("/users/me/profile", { method: "PUT", body: { nickname }, signal }),
  /** Always the signed-in user's own photo: there is no user id in the request. */
  uploadPhoto: (file: File) => {
    const body = new FormData();
    body.append("file", file);
    return apiRequest<{ profilePhotoVersion: number }>("/users/me/profile-photo", { method: "PUT", body });
  },
  deletePhoto: () => apiRequest<void>("/users/me/profile-photo", { method: "DELETE" }),
};

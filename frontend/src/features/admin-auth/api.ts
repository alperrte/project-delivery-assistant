import { apiRequest } from "@/lib/api/client";

/**
 * The separate administrator sign-in (`/pd-admin`). The password step never opens a session: it answers which second
 * step is next and sets a single-use HttpOnly ticket cookie that only the matching endpoint below accepts.
 */
export type AdminLoginResponse = { status: "TWO_FACTOR_REQUIRED" | "TWO_FACTOR_ENROLLMENT_REQUIRED" };

/** The new authenticator secret exists only in this response; it is held in the enrollment step's memory and nowhere else. */
export type AdminTwoFactorSetup = { secret: string; otpauthUri: string };

export const adminAuthApi = {
  login: (body: { email: string; password: string }) =>
    apiRequest<AdminLoginResponse>("/auth/admin/login", { method: "POST", body }),
  setup: () => apiRequest<AdminTwoFactorSetup>("/auth/admin/2fa/setup", { method: "POST" }),
  /** The first right code switches two-step verification on, opens the session and returns the backup codes once. */
  enable: (body: { code: string }) =>
    apiRequest<{ status: "SIGNED_IN"; recoveryCodes: string[] }>("/auth/admin/2fa/enable", { method: "POST", body }),
  /** An authenticator code or one unused backup code opens the session. */
  login2fa: (body: { code: string }) =>
    apiRequest<{ status: "SIGNED_IN" }>("/auth/admin/login/2fa", { method: "POST", body }),
};

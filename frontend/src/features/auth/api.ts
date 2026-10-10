import { apiRequest, apiUrl } from "@/lib/api/client";
import type { AcceptedExternalInvitation } from "@/features/invitations/types";

export type OAuthProvider = "google" | "github";

export type AuthenticatedUser = {
  id: string;
  email: string;
  nickname: string;
  globalRole: string;
  mustChangePassword: boolean;
  /** Set only while the account has a profile photo; used as the `?v=` cache buster. */
  profilePhotoVersion?: number | null;
};

/** `TWO_FACTOR_REQUIRED`: the password was right but no session is open yet; the authenticator code is the next step. */
export type LoginResponse = { status?: "TWO_FACTOR_REQUIRED" } | undefined;

export type TwoFactorStatus = {
  /** False when the server has no TOTP_ENCRYPTION_KEY, so the feature cannot be turned on. */
  available: boolean;
  enabled: boolean;
  recoveryCodesLeft: number;
  /** False for accounts that only sign in with Google/GitHub (nothing to confirm with a password). */
  passwordRequired: boolean;
};

export type OwnedResource = { kind: "PROJECT" | "ORGANIZATION"; id: string; name: string; slug: string };

export const authApi = {
  login: (body: { email: string; password: string }) =>
    apiRequest<LoginResponse>("/auth/login", { method: "POST", body }),
  login2fa: (body: { code: string }) => apiRequest("/auth/login/2fa", { method: "POST", body }),
  register: (body: {
    email: string;
    nickname: string;
    password: string;
    confirmPassword: string;
    locale: string;
  }) => apiRequest("/auth/register", { method: "POST", body }),
  verifyRegistration: (body: { email: string; code: string }) =>
    apiRequest("/auth/register/verify", { method: "POST", body }),
  resendVerification: (body: { email: string; locale: string }) =>
    apiRequest("/auth/register/resend", { method: "POST", body }),
  registerInvitation: (body: { token: string; email: string; firstName: string; lastName: string; nickname: string; password: string; confirmPassword: string }) =>
    apiRequest<AcceptedExternalInvitation>("/auth/register/invitation", { method: "POST", body }),
  me: (signal?: AbortSignal) => apiRequest<AuthenticatedUser>("/auth/me", { signal }),
  logout: () => apiRequest("/auth/logout", { method: "POST" }),

  forgotPassword: (body: { email: string; locale: string }) =>
    apiRequest("/auth/password/forgot", { method: "POST", body }),
  /** Exchanges the mailed code for a short-lived HttpOnly ticket cookie that `resetPassword` needs. */
  verifyResetCode: (body: { email: string; code: string }) =>
    apiRequest("/auth/password/reset/verify", { method: "POST", body }),
  resetPassword: (body: { newPassword: string; confirmPassword: string }) =>
    apiRequest("/auth/password/reset", { method: "POST", body }),

  sendChangeCode: (body: { locale: string }) => apiRequest("/auth/password/change/code", { method: "POST", body }),
  /** Exchanges the mailed code for a ticket cookie that `changePassword` needs. */
  verifyChangeCode: (body: { code: string }) => apiRequest("/auth/password/change/verify", { method: "POST", body }),
  changePassword: (body: {
    currentPassword: string;
    newPassword: string;
    confirmNewPassword: string;
  }) => apiRequest("/auth/password/change", { method: "POST", body }),

  twoFactorStatus: () => apiRequest<TwoFactorStatus>("/auth/2fa"),
  twoFactorSetup: () => apiRequest<{ secret: string; otpauthUri: string }>("/auth/2fa/setup", { method: "POST" }),
  twoFactorEnable: (body: { code: string }) =>
    apiRequest<{ recoveryCodes: string[] }>("/auth/2fa/enable", { method: "POST", body }),
  twoFactorDisable: (body: { password?: string; code: string }) =>
    apiRequest("/auth/2fa/disable", { method: "POST", body }),
  twoFactorRecoveryCodes: (body: { code: string }) =>
    apiRequest<{ recoveryCodes: string[] }>("/auth/2fa/recovery-codes", { method: "POST", body }),

  requestAccountDeletion: (body: { locale: string }) =>
    apiRequest("/auth/account/deletion/request", { method: "POST", body }),
  confirmAccountDeletion: (body: { token: string; email: string; password?: string; code?: string }) =>
    apiRequest("/auth/account/deletion/confirm", { method: "POST", body }),
};

/** OAuth login is a full-page navigation; the backend redirects back to /login. */
export const oauthStartUrl = (provider: OAuthProvider) =>
  apiUrl(`/auth/oauth2/authorization/${provider}`);

import { apiRequest, apiUrl } from "@/lib/api/client";
import type { AcceptedExternalInvitation } from "@/features/invitations/types";

export type OAuthProvider = "google" | "github";

export type AuthenticatedUser = {
  id: string;
  email: string;
  nickname: string;
  globalRole: string;
  mustChangePassword: boolean;
};

export const authApi = {
  login: (body: { email: string; password: string }) =>
    apiRequest("/auth/login", { method: "POST", body }),
  register: (body: {
    email: string;
    nickname: string;
    password: string;
    confirmPassword: string;
  }) => apiRequest("/auth/register", { method: "POST", body }),
  registerInvitation: (body: { token: string; email: string; firstName: string; lastName: string; nickname: string; password: string; confirmPassword: string }) =>
    apiRequest<AcceptedExternalInvitation>("/auth/register/invitation", { method: "POST", body }),
  me: () => apiRequest<AuthenticatedUser>("/auth/me"),
  logout: () => apiRequest("/auth/logout", { method: "POST" }),
  forgotPassword: (body: { email: string }) =>
    apiRequest("/auth/password/forgot", { method: "POST", body }),
  resetPassword: (body: {
    email: string;
    code: string;
    newPassword: string;
    confirmPassword: string;
  }) => apiRequest("/auth/password/reset", { method: "POST", body }),
  changePassword: (body: {
    currentPassword: string;
    newPassword: string;
    confirmNewPassword: string;
  }) => apiRequest("/auth/password/change", { method: "POST", body }),
};

/** OAuth login is a full-page navigation; the backend redirects back to /login. */
export const oauthStartUrl = (provider: OAuthProvider) =>
  apiUrl(`/auth/oauth2/authorization/${provider}`);

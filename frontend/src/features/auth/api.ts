import { apiRequest, apiUrl } from "@/lib/api/client";

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
  me: () => apiRequest<AuthenticatedUser>("/auth/me"),
  logout: () => apiRequest("/auth/logout", { method: "POST" }),
};

/** OAuth login is a full-page navigation; the backend redirects back to /login. */
export const oauthStartUrl = (provider: OAuthProvider) =>
  apiUrl(`/auth/oauth2/authorization/${provider}`);

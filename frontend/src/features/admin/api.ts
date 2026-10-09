import { apiRequest } from "@/lib/api/client";

export type AccountStatus = "ACTIVE" | "DISABLED" | "PENDING_VERIFICATION";

/** What the server returns for one account: no password hash, token or session data. */
export type AdminUser = {
  id: string;
  email: string;
  nickname: string;
  accountStatus: AccountStatus;
  emailVerificationStatus: string;
  globalRole: "ADMIN" | "USER";
  mustChangePassword: boolean;
  createdAt: string;
};

export type AdminUserPage = { items: AdminUser[]; page: number; size: number; totalElements: number };

export type AdminUserQuery = { page: number; size: number; search: string; status: AccountStatus | "" };

export type TrafficSource = "DIRECT" | "SEARCH" | "REFERRAL" | "CAMPAIGN";

/** The dashboard as the server composes it: aggregates only, never a person, a message or a session. */
export type AnalyticsDashboard = {
  range: { from: string; to: string; zone: string; days: number };
  traffic: {
    visits: number;
    uniqueSessions: number;
    uniqueVisitors: number;
    averageEngagedSeconds: number;
    daily: { date: string; visits: number; sessions: number }[];
    sources: { source: TrafficSource; sessions: number }[];
    topReferrers: { name: string; sessions: number }[];
    topCampaigns: { source: string | null; medium: string | null; campaign: string | null; sessions: number }[];
  };
  registrations: { inRange: number; daily: { date: string; value: number }[] };
  accounts: { total: number; active: number; terminated: number; pendingVerification: number; admins: number };
  contactRequests: { inRange: number; total: number; daily: { date: string; value: number }[] };
};

export type AnalyticsRange = { from: string; to: string; zone: string };

export const adminApi = {
  analytics: ({ from, to, zone }: AnalyticsRange, signal?: AbortSignal) =>
    apiRequest<AnalyticsDashboard>(`/admin/analytics?${new URLSearchParams({ from, to, zone }).toString()}`, { signal }),
  users: ({ page, size, search, status }: AdminUserQuery, signal?: AbortSignal) => {
    const params = new URLSearchParams({ page: String(page), size: String(size) });
    if (search.trim()) params.set("search", search.trim());
    if (status) params.set("status", status);
    return apiRequest<AdminUserPage>(`/admin/users?${params.toString()}`, { signal });
  },
  /** "Terminate membership": the account becomes DISABLED, its sessions end. Reversible; nothing is deleted. */
  disable: (userId: string) => apiRequest(`/admin/users/${userId}/disable`, { method: "POST" }),
  enable: (userId: string) => apiRequest(`/admin/users/${userId}/enable`, { method: "POST" }),
};

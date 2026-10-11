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

export type PlatformPermission = "USER_MANAGE" | "SESSION_MANAGE" | "AUDIT_VIEW" | "SYSTEM_VIEW";
export type OAuthProvider = "GOOGLE" | "GITHUB";

/** One account with what its role grants. The permissions are derived from the role on the server and cannot be edited. */
export type AdminUserDetail = {
  user: AdminUser;
  linkedProviders: OAuthProvider[];
  activeSessions: number;
  platformPermissions: PlatformPermission[];
};

/** An active session: when it started, was last used and ends, and the browser's own user agent. No token material. */
export type AdminSession = { id: string; createdAt: string; lastUsedAt: string | null; expiresAt: string; userAgent: string | null };

export type SystemStatus = {
  status: "UP" | "DOWN";
  database: boolean;
  googleLoginConfigured: boolean;
  githubLoginConfigured: boolean;
  mailEnabled: boolean;
  apiDocsEnabled: boolean;
  totpEncryptionKeyConfigured: boolean;
  activeSessions: number;
  httpErrorsLast24h: { clientErrors: number; serverErrors: number };
  scheduledJobs: { name: string; lastRunAt: string | null; lastOutcome: "SUCCESS" | "FAILURE" | null; lastAffected: number }[];
};

export type AdminOverview = {
  users: { total: number; active: number; disabled: number; pendingVerification: number; admins: number };
  projects: { total: number; active: number; archived: number };
};

export type AdminProject = { id: string; name: string; slug: string; status: string; archived: boolean; activeMembers: number; createdAt: string };
export type AdminProjectPage = { items: AdminProject[]; page: number; size: number; totalElements: number };

export const AUDIT_ACTIONS = ["ADMIN_SIGN_IN", "USER_DISABLE", "USER_ENABLE", "SESSION_REVOKE", "SESSION_REVOKE_ALL", "SUPPORT_REQUEST_STATUS_CHANGE"] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];
export type AuditOutcome = "SUCCESS" | "FAILURE" | "DENIED";
export type AuditTargetType = "USER" | "SUPPORT_REQUEST" | "SYSTEM";

/** Ids, codes and times, plus the nickname of the accounts involved (null when the account is gone or anonymised). */
export type AuditEvent = {
  id: string;
  occurredAt: string;
  actorUserId: string | null;
  actorNickname: string | null;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: string | null;
  targetNickname: string | null;
  outcome: AuditOutcome;
};
export type AuditPage = { items: AuditEvent[]; page: number; size: number; totalElements: number };
export type AuditQuery = { page: number; size: number; action: AuditAction | ""; from: string; to: string; zone: string };

export const SUPPORT_STATUSES = ["NEW", "IN_PROGRESS", "CLOSED"] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];
export const SUPPORT_CATEGORIES = ["GENERAL", "BUG", "DATA_REQUEST", "ACCESSIBILITY"] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];
export type DeliveryStatus = "SENT" | "FAILED";

export type SupportSummary = {
  id: string;
  createdAt: string;
  category: SupportCategory;
  firstName: string;
  lastName: string | null;
  email: string;
  status: SupportStatus;
  statusChangedAt: string | null;
  deliveryStatus: DeliveryStatus;
  messagePreview: string;
};
export type SupportPage = { items: SupportSummary[]; page: number; size: number; totalElements: number };
/** What a visitor typed. Always shown as plain text, never as markup. */
export type SupportDetail = Omit<SupportSummary, "messagePreview"> & { message: string };
export type SupportQuery = { page: number; size: number; status: SupportStatus | ""; category: SupportCategory | "" };

export type TrafficSource = "DIRECT" | "SEARCH" | "REFERRAL" | "CAMPAIGN";

/** Route templates ("/projects/[slug]"), never a concrete id or query. Every list holds at most ten entries. */
export type BehaviorReport = {
  topPages: { path: string; views: number; sessions: number }[];
  entryPages: { path: string; sessions: number }[];
  exitPages: { path: string; sessions: number }[];
  flows: { fromPath: string; toPath: string; sessions: number }[];
  notFound: { views: number; sessions: number };
  ctas: { ctaId: string; clicks: number; sessions: number }[];
  conversions: {
    sessions: number;
    converted: number;
    bySource: { source: TrafficSource; sessions: number; converted: number }[];
    byCampaign: { source: string | null; medium: string | null; campaign: string | null; sessions: number; converted: number }[];
  };
  clientErrors: {
    total: number;
    byKind: { kind: string; count: number }[];
    byRoute: { path: string; kind: string; count: number }[];
  };
};

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
  /** Optional so that an answer without it still renders the rest of the page. */
  behavior?: BehaviorReport;
};

export type AnalyticsRange = { from: string; to: string; zone: string };

const id = encodeURIComponent;

export const adminApi = {
  analytics: ({ from, to, zone }: AnalyticsRange, signal?: AbortSignal) =>
    apiRequest<AnalyticsDashboard>(`/admin/analytics?${new URLSearchParams({ from, to, zone }).toString()}`, { signal }),
  users: ({ page, size, search, status }: AdminUserQuery, signal?: AbortSignal) => {
    const params = new URLSearchParams({ page: String(page), size: String(size) });
    if (search.trim()) params.set("search", search.trim());
    if (status) params.set("status", status);
    return apiRequest<AdminUserPage>(`/admin/users?${params.toString()}`, { signal });
  },
  user: (userId: string, signal?: AbortSignal) => apiRequest<AdminUserDetail>(`/admin/users/${id(userId)}`, { signal }),
  sessions: (userId: string, signal?: AbortSignal) => apiRequest<AdminSession[]>(`/admin/users/${id(userId)}/sessions`, { signal }),
  /** The person is signed out on that one device; the account and its other sessions are untouched. */
  revokeSession: (userId: string, sessionId: string) =>
    apiRequest(`/admin/users/${id(userId)}/sessions/${id(sessionId)}/revoke`, { method: "POST" }),
  revokeAllSessions: (userId: string) => apiRequest<{ revoked: number }>(`/admin/users/${id(userId)}/sessions/revoke-all`, { method: "POST" }),
  /** "Terminate membership": the account becomes DISABLED, its sessions end. Reversible; nothing is deleted. */
  disable: (userId: string) => apiRequest(`/admin/users/${id(userId)}/disable`, { method: "POST" }),
  enable: (userId: string) => apiRequest(`/admin/users/${id(userId)}/enable`, { method: "POST" }),
  systemStatus: (signal?: AbortSignal) => apiRequest<SystemStatus>("/admin/system/status", { signal }),
  overview: (signal?: AbortSignal) => apiRequest<AdminOverview>("/admin/overview", { signal }),
  projects: ({ page, size }: { page: number; size: number }, signal?: AbortSignal) =>
    apiRequest<AdminProjectPage>(`/admin/projects?${new URLSearchParams({ page: String(page), size: String(size) }).toString()}`, { signal }),
  auditEvents: ({ page, size, action, from, to, zone }: AuditQuery, signal?: AbortSignal) => {
    const params = new URLSearchParams({ page: String(page), size: String(size), zone });
    if (action) params.set("action", action);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return apiRequest<AuditPage>(`/admin/audit-events?${params.toString()}`, { signal });
  },
  supportRequests: ({ page, size, status, category }: SupportQuery, signal?: AbortSignal) => {
    const params = new URLSearchParams({ page: String(page), size: String(size) });
    if (status) params.set("status", status);
    if (category) params.set("category", category);
    return apiRequest<SupportPage>(`/admin/support-requests?${params.toString()}`, { signal });
  },
  supportRequest: (requestId: string, signal?: AbortSignal) => apiRequest<SupportDetail>(`/admin/support-requests/${id(requestId)}`, { signal }),
  changeSupportStatus: (requestId: string, status: SupportStatus) =>
    apiRequest<SupportDetail>(`/admin/support-requests/${id(requestId)}/status`, { method: "POST", body: { status } }),
};

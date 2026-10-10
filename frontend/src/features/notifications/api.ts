import { apiRequest } from "@/lib/api/client";
import type { Page } from "@/types/pagination";
import type { Notification } from "./types";
export type { Notification } from "./types";

/** `type` stays the single-type filter; `types` repeats the `type` parameter. `projectId` narrows to one project. */
export type NotificationListFilter = { read?: boolean; size?: number; type?: string; types?: readonly string[]; projectId?: string };
export type NotificationCountFilter = { projectId?: string; types?: readonly string[] };

/** Invitation answers (accepted/rejected) delivered to the inviter. */
export const INVITATION_RESPONSE_TYPES = ["PROJECT_INVITATION_ACCEPTED", "PROJECT_INVITATION_REJECTED"] as const;
export function notificationListPath(page = 0, filter: NotificationListFilter = {}) {
  const params = new URLSearchParams({ page: String(page), size: String(filter.size ?? 20) });
  if (filter.read !== undefined) params.set("read", String(filter.read));
  if (filter.type) params.set("type", filter.type);
  filter.types?.forEach(value => params.append("type", value));
  if (filter.projectId) params.set("projectId", filter.projectId);
  return `/notifications?${params}`;
}

export const notificationsApi = {
  list: (page = 0, signal?: AbortSignal, filter: NotificationListFilter = {}) => apiRequest<Page<Notification>>(notificationListPath(page, filter), { signal }),
  count: (signal?: AbortSignal) => apiRequest<{ count: number }>("/notifications/unread-count", { signal }),
  /** Own unread count; both filters are optional and omitted means the whole unread total. */
  unreadCount: (filter: NotificationCountFilter = {}, signal?: AbortSignal) => {
    const params = new URLSearchParams();
    if (filter.projectId) params.set("projectId", filter.projectId);
    filter.types?.forEach(value => params.append("type", value));
    const query = params.toString();
    return apiRequest<{ count: number }>(`/notifications/unread-count${query ? `?${query}` : ""}`, { signal });
  },
  read: (id: string, signal?: AbortSignal) => apiRequest<Notification>(`/notifications/${id}/read`, { method: "PATCH", signal }),
  readAll: (signal?: AbortSignal) => apiRequest<{ count: number }>("/notifications/read-all", { method: "PATCH", signal }),
  /** Permanently deletes one of the caller's own READ notifications (204); unknown, foreign or unread ids answer 404. */
  deleteOne: (id: string, signal?: AbortSignal) => apiRequest<void>(`/notifications/${encodeURIComponent(id)}`, { method: "DELETE", signal }),
  /** Permanently deletes every READ notification of the caller; unread ones are never touched. */
  deleteAllRead: (signal?: AbortSignal) => apiRequest<{ count: number }>("/notifications?read=true", { method: "DELETE", signal }),
  claim: (signal?: AbortSignal) => apiRequest<Notification | undefined>("/notifications/team-deletions/claim", { method: "POST", signal }),
};

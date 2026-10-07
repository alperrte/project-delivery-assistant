import { apiRequest } from "@/lib/api/client";
import type { Page } from "@/types/pagination";
import type { Notification } from "./types";
export type { Notification } from "./types";

export type NotificationListFilter = { read?: boolean; size?: number; type?: string };
export function notificationListPath(page = 0, filter: NotificationListFilter = {}) {
  const params = new URLSearchParams({ page: String(page), size: String(filter.size ?? 20) });
  if (filter.read !== undefined) params.set("read", String(filter.read));
  if (filter.type) params.set("type", filter.type);
  return `/notifications?${params}`;
}

export const notificationsApi = {
  list: (page = 0, signal?: AbortSignal, filter: NotificationListFilter = {}) => apiRequest<Page<Notification>>(notificationListPath(page, filter), { signal }),
  count: (signal?: AbortSignal) => apiRequest<{ count: number }>("/notifications/unread-count", { signal }),
  read: (id: string, signal?: AbortSignal) => apiRequest<Notification>(`/notifications/${id}/read`, { method: "PATCH", signal }),
  readAll: (signal?: AbortSignal) => apiRequest<{ count: number }>("/notifications/read-all", { method: "PATCH", signal }),
  claim: (signal?: AbortSignal) => apiRequest<Notification | undefined>("/notifications/team-deletions/claim", { method: "POST", signal }),
};

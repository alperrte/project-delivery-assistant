import { apiRequest } from "@/lib/api/client";
import type { Page } from "@/types/pagination";
import type { Notification } from "./types";

export const notificationsApi = {
  list: (page = 0, signal?: AbortSignal) => apiRequest<Page<Notification>>(`/notifications?page=${page}&size=20`, { signal }),
  count: (signal?: AbortSignal) => apiRequest<{ count: number }>("/notifications/unread-count", { signal }),
  read: (id: string) => apiRequest<Notification>(`/notifications/${id}/read`, { method: "PATCH" }),
  readAll: () => apiRequest<{ count: number }>("/notifications/read-all", { method: "PATCH" }),
  claim: (signal?: AbortSignal) => apiRequest<Notification | undefined>("/notifications/team-deletions/claim", { method: "POST", signal }),
};

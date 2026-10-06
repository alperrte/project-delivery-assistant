import { apiRequest } from "@/lib/api/client";
import type { Page } from "@/types/pagination";
import type { TaskStatus } from "@/features/tasks/types";

export type Notification = {
  id: string; type: string; title: string; message: string; read: boolean;
  createdAt: string; readAt: string | null; actorUserId: string | null;
  projectId: string | null; resourceType: string; resourceId: string;
  statusChange?: { previousStatus: TaskStatus; newStatus: TaskStatus; taskKey: string; taskTitle: string; actorNickname: string | null } | null;
};
export const notificationsApi = {
  list: (page: number) => apiRequest<Page<Notification>>(`/notifications?page=${page}&size=20`),
  count: () => apiRequest<{ count: number }>("/notifications/unread-count"),
  read: (id: string) => apiRequest<Notification>(`/notifications/${id}/read`, { method: "PATCH" }),
  readAll: () => apiRequest<{ count: number }>("/notifications/read-all", { method: "PATCH" }),
};

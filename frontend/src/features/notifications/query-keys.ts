import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { NotificationListFilter } from "./api";

export const notificationKeys = {
  root: ["notifications"] as const,
  actor: (userId: string | undefined) => ["notifications", "actor", userId] as const,
  count: (userId: string | undefined) => [...notificationKeys.actor(userId), "count"] as const,
  lists: (userId: string | undefined) => [...notificationKeys.actor(userId), "list"] as const,
  list: (userId: string | undefined, page: number, filter: NotificationListFilter = {}) =>
    [...notificationKeys.lists(userId), filter.read ?? "all", page, filter.size ?? 20, filter.type ?? "all"] as const,
  /** Unread invitation answers of one project; both live under the actor family so every reconcile/cleanup covers them. */
  invitationResponseCount: (userId: string | undefined, projectId: string | undefined) =>
    [...notificationKeys.count(userId), "invitation-responses", projectId] as const,
  invitationResponseList: (userId: string | undefined, projectId: string | undefined) =>
    [...notificationKeys.lists(userId), "invitation-responses", projectId] as const,
};

export async function reconcileNotificationRead(client: QueryClient, userId: string) {
  await Promise.all([
    client.cancelQueries({ queryKey: notificationKeys.lists(userId) }),
    client.cancelQueries({ queryKey: notificationKeys.count(userId) }),
  ]);
  await Promise.all([
    client.invalidateQueries({ queryKey: notificationKeys.lists(userId) }, { throwOnError: true }),
    client.invalidateQueries({ queryKey: notificationKeys.count(userId) }, { throwOnError: true }),
  ]);
}

const privateToasts = new Map<string, Set<string | number>>();
export function trackNotificationToast(userId: string, id: string | number) {
  let ids = privateToasts.get(userId);
  if (!ids) privateToasts.set(userId, ids = new Set());
  ids.add(id);
}
export function untrackNotificationToast(userId: string, id: string | number) {
  const ids = privateToasts.get(userId);
  ids?.delete(id);
  if (ids?.size === 0) privateToasts.delete(userId);
}
export function dismissNotificationToasts(userId?: string) {
  for (const [actor, ids] of privateToasts) {
    if (userId && actor !== userId) continue;
    ids.forEach(id => toast.dismiss(id));
    privateToasts.delete(actor);
  }
}
export function clearPrivateNotifications(client: QueryClient) {
  void client.cancelQueries({ queryKey: notificationKeys.root });
  client.removeQueries({ queryKey: notificationKeys.root });
  dismissNotificationToasts();
}

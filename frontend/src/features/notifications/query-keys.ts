import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const notificationKeys = {
  root: ["notifications"] as const,
  actor: (userId: string | undefined) => ["notifications", "actor", userId] as const,
  count: (userId: string | undefined) => [...notificationKeys.actor(userId), "count"] as const,
  list: (userId: string | undefined, page: number) => [...notificationKeys.actor(userId), "list", page] as const,
};

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

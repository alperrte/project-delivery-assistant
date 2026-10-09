import type { QueryClient } from "@tanstack/react-query";

/**
 * Every admin query is scoped by the acting administrator: ["admin", actorId, ...]. A different account therefore
 * never reads another account's entry, and the whole family is removed when a session ends or begins.
 */
export const adminKeys = {
  root: ["admin"] as const,
  actor: (actorId: string | undefined) => ["admin", actorId] as const,
  users: (actorId: string | undefined) => ["admin", actorId, "users"] as const,
  usersPage: (actorId: string | undefined, params: { page: number; size: number; search: string; status: string }) =>
    ["admin", actorId, "users", params.page, params.size, params.search, params.status] as const,
  analytics: (actorId: string | undefined, range: { from: string; to: string; zone: string }) =>
    ["admin", actorId, "analytics", range.from, range.to, range.zone] as const,
};

/** Sign-out, an ended session, a 401 and every sign-in remove all admin data and stop requests still in flight. */
export function clearPrivateAdmin(client: QueryClient) {
  void client.cancelQueries({ queryKey: adminKeys.root });
  client.removeQueries({ queryKey: adminKeys.root });
}

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
  user: (actorId: string | undefined, userId: string) => ["admin", actorId, "users", "detail", userId] as const,
  userSessions: (actorId: string | undefined, userId: string) => ["admin", actorId, "users", "detail", userId, "sessions"] as const,
  analytics: (actorId: string | undefined, range: { from: string; to: string; zone: string }) =>
    ["admin", actorId, "analytics", range.from, range.to, range.zone] as const,
  system: (actorId: string | undefined) => ["admin", actorId, "system"] as const,
  systemStatus: (actorId: string | undefined) => ["admin", actorId, "system", "status"] as const,
  overview: (actorId: string | undefined) => ["admin", actorId, "system", "overview"] as const,
  projects: (actorId: string | undefined, page: number) => ["admin", actorId, "system", "projects", page] as const,
  audit: (actorId: string | undefined) => ["admin", actorId, "audit"] as const,
  auditPage: (actorId: string | undefined, params: { page: number; size: number; action: string; from: string; to: string; zone: string }) =>
    ["admin", actorId, "audit", params.page, params.size, params.action, params.from, params.to, params.zone] as const,
  support: (actorId: string | undefined) => ["admin", actorId, "support"] as const,
  supportPage: (actorId: string | undefined, params: { page: number; size: number; status: string; category: string }) =>
    ["admin", actorId, "support", "list", params.page, params.size, params.status, params.category] as const,
  supportRequest: (actorId: string | undefined, requestId: string) => ["admin", actorId, "support", "detail", requestId] as const,
  /** How many requests still wait for a first look: one cheap list call (size 1) read for its total. */
  supportNewCount: (actorId: string | undefined) => ["admin", actorId, "support", "new-count"] as const,
};

/** Sign-out, an ended session, a 401 and every sign-in remove all admin data and stop requests still in flight. */
export function clearPrivateAdmin(client: QueryClient) {
  void client.cancelQueries({ queryKey: adminKeys.root });
  client.removeQueries({ queryKey: adminKeys.root });
}

import { matchPath, type PageRoute } from "@/i18n/routing";

/** A route policy, not a visited-history list. Tests compare it with the real (app) layout routes. */
export const AUTHENTICATED_ROUTES = [
  "/dashboard", "/projects", "/projects/new", "/projects/[slug]",
  "/projects/[slug]/overview", "/projects/[slug]/criteria", "/projects/[slug]/teams", "/projects/[slug]/team-invitations", "/projects/[slug]/repository", "/projects/[slug]/edit",
  "/projects/[slug]/teams/new", "/projects/[slug]/teams/[teamId]", "/projects/[slug]/teams/[teamId]/edit", "/projects/[slug]/teams/[teamId]/members",
  "/projects/[slug]/tasks", "/projects/[slug]/tasks/new", "/projects/[slug]/tasks/board", "/projects/[slug]/tasks/pool", "/projects/[slug]/tasks/[taskId]", "/projects/[slug]/tasks/[taskId]/edit",
  "/projects/[slug]/sprints", "/projects/[slug]/sprints/[sprintId]", "/projects/[slug]/labels",
  "/organizations", "/organizations/new", "/organizations/[organizationId]", "/organizations/[organizationId]/edit",
  "/settings", "/account", "/tasks", "/calendar", "/calendar/new", "/calendar/reminders/[reminderId]/edit",
  "/invitations", "/invitations/[projectId]/[invitationId]",
] as const satisfies readonly PageRoute[];
const privateRoutes = new Set<PageRoute>(AUTHENTICATED_ROUTES);
export function authenticatedRoute(pathname: string) {
  const match = matchPath(pathname);
  return !!match && privateRoutes.has(match.route);
}

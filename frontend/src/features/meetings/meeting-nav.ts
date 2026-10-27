/**
 * Where in the sidebar's meetings group a page belongs. It reads the address only: no project, project selection or route parameter takes part,
 * so the highlight is the same with a project selected, with another one, or with none.
 */
export function meetingNavActive(pathname: string): "create" | "myMeetings" | null {
  if (pathname === "/meetings/new") return "create";
  return pathname === "/meetings" || pathname.startsWith("/meetings/") ? "myMeetings" : null;
}

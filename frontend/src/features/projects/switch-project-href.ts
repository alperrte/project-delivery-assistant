import { allowsAdvanced, allowsPool } from "@/features/tasks/task-model";
import type { Project } from "./types";

/** Keep only shared project surfaces; never transplant another project's IDs or filters. */
export function switchProjectHref(pathname: string, section: string | null, target: Project,
  options: { manager: boolean; repository: boolean }) {
  const route = /^\/projects\/([^/]+)(.*)$/.exec(pathname);
  if (!route || route[1] === "new") return null;
  const root = `/projects/${target.slug}`;
  const suffix = route[2];
  if (!suffix) {
    if (["criteria", "teams"].includes(section ?? "")) return `${root}?section=${section}`;
    if (section === "invitations" && options.manager) return `${root}?section=invitations`;
    if (section === "repository" && options.repository) return `${root}?section=repository`;
    return root;
  }
  if (["/teams", "/criteria", "/tasks", "/tasks/board"].includes(suffix)) return `${root}${suffix}`;
  if (suffix === "/tasks/pool" && allowsPool(target.taskManagementMode)) return `${root}${suffix}`;
  if (suffix === "/sprints" && allowsAdvanced(target.taskManagementMode)) return `${root}${suffix}`;
  if (suffix === "/labels" && options.manager && allowsAdvanced(target.taskManagementMode)) return `${root}${suffix}`;
  return root;
}

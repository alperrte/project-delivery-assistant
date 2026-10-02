import {
  ChartBar, CheckCircle, EnvelopeSimple, GearSix, GithubLogo, Kanban, ListChecks, Lightning, Tag, Tray, UsersThree,
} from "@phosphor-icons/react";

export const PROJECT_SECTIONS = [
  { value: "overview", icon: ChartBar },
  { value: "criteria", icon: CheckCircle },
  { value: "teams", icon: UsersThree },
  { value: "invitations", icon: EnvelopeSimple, managerOnly: true, parent: "teams" },
  { value: "repository", icon: GithubLogo },
  { value: "settings", icon: GearSix, managerOnly: true },
] as const;

export type ProjectSection = (typeof PROJECT_SECTIONS)[number]["value"];

export function projectSection(value: string | null, isManager: boolean): ProjectSection {
  if (value === "members" || value === "squads") return "teams";
  const section = PROJECT_SECTIONS.find(item => item.value === value);
  if (!section || ("managerOnly" in section && section.managerOnly && !isManager)) return "overview";
  return section.value;
}

export function projectSectionHref(pathname: string, section: ProjectSection): string {
  return section === "overview" ? pathname : `${pathname}?section=${section}`;
}

/**
 * Task management lives on real routes (not `?section=`) because lists, the board and details are deep-linkable
 * and keep their own filters in the URL. `path` is relative to `/projects/[slug]`.
 */
export const TASK_NAV = [
  { value: "tasks", icon: ListChecks, path: "/tasks" },
  { value: "board", icon: Kanban, path: "/tasks/board" },
  { value: "pool", icon: Tray, path: "/tasks/pool" },
  { value: "sprints", icon: Lightning, path: "/sprints" },
  { value: "labels", icon: Tag, path: "/labels", managerOnly: true },
] as const;

export type TaskNavItem = (typeof TASK_NAV)[number]["value"];

/** Project slug when the pathname is inside the task management routes (tasks, sprints, labels). */
export function taskRouteSlug(pathname: string): string | undefined {
  return /^\/projects\/([^/]+)\/(?:tasks|sprints|labels)(?:\/|$)/.exec(pathname)?.[1];
}

/** Which task management nav item a pathname belongs to; `null` outside those routes. */
export function taskNavActive(pathname: string): TaskNavItem | null {
  const match = /^\/projects\/[^/]+\/(tasks|sprints|labels)(?:\/([^/]+))?/.exec(pathname);
  if (!match) return null;
  if (match[1] === "sprints") return "sprints";
  if (match[1] === "labels") return "labels";
  if (match[2] === "board") return "board";
  if (match[2] === "pool") return "pool";
  return "tasks";
}

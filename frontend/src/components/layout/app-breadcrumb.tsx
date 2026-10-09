"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { usePathname, useSearchParams } from "@/i18n/navigation";
import { Breadcrumb, type Crumb } from "@/components/common/breadcrumb";
import { projectsApi } from "@/features/projects/api";
import { projectSection } from "@/features/projects/project-sections";
import { useBreadcrumbEntry } from "./breadcrumb-labels";

/**
 * The trail for every signed-in page that sits below a section (a project, an organization, the calendar…).
 * It is read from the URL so no page has to build its own; a page only names its record through `BreadcrumbLabel`.
 * Top-level pages have nothing above them, so they show no trail.
 */
export function AppBreadcrumb() {
  const pathname = usePathname();
  const section = useSearchParams().get("section");
  const common = useTranslations("common");
  const titles = useTranslations("pageTitles");
  const tabs = useTranslations("projects.detail.tabs");
  const nav = useTranslations("tasks.nav");
  const team = useBreadcrumbEntry("team");
  const task = useBreadcrumbEntry("task");
  const sprint = useBreadcrumbEntry("sprint");
  const organization = useBreadcrumbEntry("organization");

  const [root, first, second, ...rest] = pathname.split("/").filter(Boolean);
  const slug = root === "projects" && first && first !== "new" ? first : undefined;
  const project = useQuery({ queryKey: ["projects", "by-slug", slug], queryFn: () => projectsApi.bySlug(slug!), enabled: !!slug });
  if (project.isError) return null;

  const projectCrumb: Crumb = {
    label: project.data?.name ?? <><span aria-hidden="true" className="inline-block h-3.5 w-24 animate-pulse rounded bg-muted align-middle" /><span className="sr-only">{common("loading")}</span></>,
    href: `/projects/${slug}`,
  };
  const items: Crumb[] = [];

  if (root === "projects" && first === "new") {
    items.push({ label: titles("projects"), href: "/projects" }, { label: titles("projectNew") });
  } else if (slug) {
    const base = `/projects/${slug}`;
    items.push({ label: titles("projects"), href: "/projects" }, projectCrumb);
    if (!second) {
      const current = projectSection(section, true);
      if (current !== "overview") items.push({ label: tabs(current) });
    } else if (second === "teams") {
      items.push({ label: tabs("teams"), href: `${base}?section=teams` });
      const [teamId, action] = rest;
      if (teamId === "new") items.push({ label: titles("teamNew") });
      else if (teamId) {
        items.push({ label: team?.label ?? titles("team"), href: `${base}/teams/${teamId}` });
        if (action === "edit") items.push({ label: titles("teamEdit") });
      }
    } else if (second === "tasks") {
      items.push({ label: nav("tasks"), href: `${base}/tasks` });
      const [taskId, action] = rest;
      if (taskId === "new") items.push({ label: titles("taskNew") });
      else if (taskId === "board") items.push({ label: nav("board") });
      else if (taskId === "pool") items.push({ label: nav("pool") });
      else if (taskId) {
        if (task?.parent) items.push(task.parent);
        items.push({ label: task?.label ?? titles("task"), href: `${base}/tasks/${taskId}` });
        if (action === "edit") items.push({ label: titles("taskEdit") });
      }
    } else if (second === "sprints") {
      items.push({ label: nav("sprints"), href: `${base}/sprints` });
      if (rest[0]) items.push({ label: sprint?.label ?? titles("sprint") });
    } else if (second === "labels") {
      items.push({ label: nav("labels") });
    }
  } else if (root === "organizations" && first) {
    items.push({ label: titles("organizations"), href: "/organizations" });
    if (first === "new") items.push({ label: titles("organizationNew") });
    else {
      items.push({ label: organization?.label ?? titles("organization"), href: `/organizations/${first}` });
      if (second === "edit") items.push({ label: titles("organizationEdit") });
    }
  } else if (root === "calendar" && first) {
    items.push({ label: titles("calendar"), href: "/calendar" }, { label: titles(first === "new" ? "reminderNew" : "reminderEdit") });
  } else if (root === "invitations" && first) {
    items.push({ label: titles("invitations"), href: "/invitations" }, { label: titles("invitation") });
  }

  if (items.length < 2) return null;
  // The last crumb is the page itself; drop its link so it is announced as the current page.
  const last = items.length - 1;
  items[last] = { ...items[last], href: undefined };
  return <Breadcrumb label={common("breadcrumb")} items={items} className="mb-4" />;
}

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export type PageTitleKey =
  | "dashboard" | "projects" | "projectNew"
  | "projectOverview" | "projectCriteria" | "projectTeams" | "projectInvitations" | "projectRepository" | "projectEdit"
  | "criterionNew" | "criterionEdit"
  | "teamNew" | "team" | "teamEdit"
  | "tasks" | "taskNew" | "board" | "pool" | "task" | "taskEdit" | "sprints" | "sprintNew" | "sprint" | "sprintEdit" | "labels"
  | "organizations" | "organizationNew" | "organization" | "organizationEdit"
  | "settings" | "account" | "myTasks" | "calendar" | "reminderNew" | "reminderEdit"
  | "memberInvite" | "invitations" | "invitation" | "changePassword" | "adminUsers" | "adminUser" | "adminAnalytics"
  | "adminSystem" | "adminAudit" | "adminSupport" | "adminSupportRequest";

/**
 * Signed-in screens are never indexed, but the browser tab, history and screen readers still need a page name
 * (WCAG 2.4.2). The title names the kind of page: record names are only known after an authenticated API call,
 * and page requests carry no access cookie.
 */
export async function pageTitle(key: PageTitleKey): Promise<Metadata> {
  const t = await getTranslations("pageTitles");
  return { title: t(key) };
}

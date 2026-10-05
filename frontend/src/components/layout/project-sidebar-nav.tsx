"use client";

import Link from "@/i18n/navigation";
import { usePathname, useSearchParams } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { ChatNavItem } from "@/features/chat/components/chat-nav-item";
import { usePendingInvitationCount } from "@/features/invitations/hooks";
import { useCurrentMember } from "@/features/projects/hooks/use-current-member";
import { useSelectedProject } from "@/features/projects/hooks/use-selected-project";
import { allowsAdvanced } from "@/features/tasks/task-model";
import {
  PROJECT_SECTIONS,
  TASK_NAV,
  projectSection,
  projectSectionHref,
  taskNavActive,
  taskRouteSlug,
} from "@/features/projects/project-sections";
import { cn } from "@/lib/utils";
import { navItemClass } from "./nav-item";

export function ProjectSidebarNav({
  onNavigate,
  collapsed,
  pathnameOverride,
}: {
  onNavigate: () => void;
  collapsed?: boolean;
  pathnameOverride?: string;
}) {
  const t = useTranslations("projects.detail");
  const tn = useTranslations("tasks.nav");
  const routePathname = usePathname();
  const pathname = pathnameOverride ?? routePathname;
  const searchParams = useSearchParams();

  // Team pages:
  // /projects/[slug]/teams
  // /projects/[slug]/teams/new
  // /projects/[slug]/teams/[id]
  // /projects/[slug]/teams/[id]/edit
  // /projects/[slug]/teams/[id]/members
  // all belong to the Teams section.
  const teamsRoute = /^\/projects\/([^/]+)\/teams(?:\/|$)/.exec(pathname);

  // `/projects/new` is the create page, not a project called "new";
  // the sidebar keeps the last selected project there.
  const detailSlug = /^\/projects\/([^/]+)$/.exec(pathname)?.[1];

  // Tasks, sprints and labels are real routes of the "Task management" group.
  const taskActive = taskNavActive(pathname);

  const routeSlug =
    (detailSlug === "new" ? undefined : detailSlug) ??
    teamsRoute?.[1] ??
    taskRouteSlug(pathname);

  const { slug, project } = useSelectedProject(routeSlug);

  const { isManager } = useCurrentMember(project?.id ?? "");

  const { data: pendingInvitations = 0 } = usePendingInvitationCount(
    project?.id ?? "",
    isManager,
  );

  // Inside a task route no project section is highlighted; the task group owns the selection.
  const active = teamsRoute
    ? "teams"
    : taskActive
      ? null
      : projectSection(searchParams.get("section"), isManager);

  const projectPath = slug ? `/projects/${slug}` : null;

  const sections = PROJECT_SECTIONS.filter(
    (item) =>
      !("sidebar" in item && item.sidebar === false) &&
      !("managerOnly" in item && item.managerOnly && !isManager) &&
      (!!projectPath || item.value !== "teams"),
  );

  const taskItems = TASK_NAV.filter(
    (item) => !("managerOnly" in item && item.managerOnly && !isManager) &&
      (item.value === "tasks" || item.value === "board" || allowsAdvanced(project?.taskManagementMode ?? null)),
  );

  if (collapsed) {
    return (
      <div className="mt-3 space-y-0.5 border-t border-border pt-3">
        <Link
          href={projectPath ?? "/projects"}
          onClick={onNavigate}
          title={project?.name ?? t("chooseProject")}
          className="mb-1 flex items-center justify-center rounded-md py-2 hover:bg-muted"
        >
          <span
            aria-hidden="true"
            className="grid size-7 shrink-0 place-items-center rounded-md bg-primary text-[11px] font-semibold text-primary-foreground"
          >
            {project?.name?.slice(0, 1).toLocaleUpperCase() ?? "P"}
          </span>
        </Link>

        {projectPath &&
          sections
            .filter((item) => !("parent" in item))
            .map((item) => {
              const Icon = item.icon;
              const selected = !!routeSlug && active === item.value;
              const showDot =
                item.value === "teams" && pendingInvitations > 0;

              return (
                <Link
                  key={item.value}
                  href={projectSectionHref(projectPath, item.value)}
                  onClick={onNavigate}
                  title={t(`tabs.${item.value}`)}
                  aria-label={t(`tabs.${item.value}`)}
                  aria-current={selected ? "page" : undefined}
                  className={navItemClass(
                    selected,
                    "flex items-center justify-center rounded-md py-2 hover:bg-muted hover:text-foreground",
                  )}
                >
                  <span className="relative">
                    <Icon
                      size={17}
                      weight={selected ? "fill" : "regular"}
                      aria-hidden="true"
                    />

                    {showDot && (
                      <span
                        className="absolute -right-1 -top-1 size-2 rounded-full bg-primary ring-2 ring-card"
                        aria-label={t("pendingInvitations", {
                          count: pendingInvitations,
                        })}
                      />
                    )}
                  </span>
                </Link>
              );
            })}

        {projectPath && (
          <div className="mt-1 space-y-0.5 border-t border-border pt-1" role="group" aria-label={tn("group")}>
            {taskItems.map((item) => {
              const Icon = item.icon;
              const selected = taskActive === item.value;

              return (
                <Link
                  key={item.value}
                  href={`${projectPath}${item.path}`}
                  onClick={onNavigate}
                  title={tn(item.value)}
                  aria-label={tn(item.value)}
                  aria-current={selected ? "page" : undefined}
                  className={navItemClass(
                    selected,
                    "flex items-center justify-center rounded-md py-2 hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon size={17} weight={selected ? "fill" : "regular"} aria-hidden="true" />
                </Link>
              );
            })}
          </div>
        )}

        {slug && projectPath && (
          <div className="mt-1 border-t border-border pt-1">
            <ChatNavItem projectId={project?.id} slug={slug} collapsed onNavigate={onNavigate} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 border-t border-border pt-4">
      <div className="mb-2 flex items-center justify-between gap-2 px-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {t("selectedProject")}
        </p>

        {projectPath && pathname !== "/projects" && (
          <Link
            href="/projects"
            onClick={onNavigate}
            className="text-[11px] font-medium text-muted-foreground hover:text-foreground hover:underline"
          >
            {t("changeProject")}
          </Link>
        )}
      </div>

      {projectPath ? (
        <Link
          href={projectPath}
          onClick={onNavigate}
          title={project?.name}
          className="mb-2 flex min-w-0 items-center gap-2.5 rounded-md border bg-card/60 px-2.5 py-2 text-[13px] font-semibold hover:bg-muted"
        >
          <span
            aria-hidden="true"
            className="grid size-7 shrink-0 place-items-center rounded-md bg-primary text-[11px] font-semibold text-primary-foreground"
          >
            {project?.name?.slice(0, 1).toLocaleUpperCase() ?? "P"}
          </span>

          <span className="truncate">{project?.name ?? slug}</span>
        </Link>
      ) : (
        <Link
          href="/projects"
          onClick={onNavigate}
          className="mb-2 block rounded-md border border-dashed px-3 py-2 text-[12px] text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {t("chooseProject")}
        </Link>
      )}

      <div
        className="ml-2 space-y-0.5 border-l border-border pl-2"
        aria-label={t("navigation")}
      >
        {sections.map((item) => {
          const Icon = item.icon;
          const selected = !!routeSlug && active === item.value;
          const child = "parent" in item;

          const className = navItemClass(
            selected,
            cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-[13px]",
              child && "ml-5 py-1.5",
              projectPath && "hover:bg-muted hover:text-foreground",
            ),
          );

          return projectPath ? (
            <Link
              key={item.value}
              href={projectSectionHref(projectPath, item.value)}
              onClick={onNavigate}
              aria-current={selected ? "page" : undefined}
              className={className}
            >
              <Icon
                size={17}
                weight={selected ? "fill" : "regular"}
                aria-hidden="true"
              />

              {t(`tabs.${item.value}`)}

              {item.value === "invitations" &&
                pendingInvitations > 0 && (
                  <span
                    className="ml-auto min-w-5 rounded-full bg-primary px-1.5 py-0.5 text-center text-[11px] font-semibold leading-none text-primary-foreground"
                    aria-label={t("pendingInvitations", {
                      count: pendingInvitations,
                    })}
                  >
                    {pendingInvitations}
                  </span>
                )}
            </Link>
          ) : (
            <span
              key={item.value}
              aria-disabled="true"
              className={className}
            >
              <Icon size={17} aria-hidden="true" />
              {t(`tabs.${item.value}`)}
            </span>
          );
        })}
      </div>

      {projectPath && (
        <div className="ml-2 mt-3 border-l border-border pl-2" role="group" aria-label={tn("group")}>
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            {tn("group")}
          </p>

          <div className="space-y-0.5">
            {taskItems.map((item) => {
              const Icon = item.icon;
              const selected = taskActive === item.value;

              return (
                <Link
                  key={item.value}
                  href={`${projectPath}${item.path}`}
                  onClick={onNavigate}
                  aria-current={selected ? "page" : undefined}
                  className={navItemClass(
                    selected,
                    "flex items-center gap-3 rounded-md px-3 py-2 text-[13px] hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon size={17} weight={selected ? "fill" : "regular"} aria-hidden="true" />
                  {tn(item.value)}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {slug && projectPath && (
        <div className="ml-2 mt-3 border-l border-border pl-2">
          <ChatNavItem projectId={project?.id} slug={slug} onNavigate={onNavigate} />
        </div>
      )}
    </div>
  );
}

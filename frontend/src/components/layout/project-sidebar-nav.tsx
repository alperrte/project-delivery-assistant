"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/auth/hooks/use-session";
import { projectsApi } from "@/features/projects/api";
import { useCurrentMember } from "@/features/projects/hooks/use-current-member";
import { PROJECT_SECTIONS, projectSection, projectSectionHref } from "@/features/projects/project-sections";
import { cn } from "@/lib/utils";
import { navItemClass } from "./nav-item";

const selectionEvent = "pda:project-selection-changed";

function subscribeToSelection(onChange: () => void) {
  window.addEventListener(selectionEvent, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(selectionEvent, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function ProjectSidebarNav({ onNavigate, collapsed }: { onNavigate: () => void; collapsed?: boolean }) {
  const t = useTranslations("projects.detail");
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: user } = useSession();
  const routeSlug = /^\/projects\/([^/]+)$/.exec(pathname)?.[1];
  const rememberedSlug = useSyncExternalStore(
    subscribeToSelection,
    () => user?.id ? sessionStorage.getItem(`pda:last-project:${user.id}`) : null,
    () => null,
  );
  const { data: projectList } = useQuery({
    queryKey: ["projects", "sidebar-default", user?.id],
    queryFn: () => projectsApi.list(0, 1),
    enabled: !!user,
  });
  const slug = routeSlug ?? rememberedSlug ?? projectList?.content[0]?.slug;
  const { data: project } = useQuery({
    queryKey: ["projects", "by-slug", slug],
    queryFn: () => projectsApi.bySlug(slug!),
    enabled: !!slug,
  });
  const { isManager } = useCurrentMember(project?.id ?? "");
  const active = projectSection(searchParams.get("section"), isManager);
  const projectPath = slug ? `/projects/${slug}` : null;

  useEffect(() => {
    if (!user?.id || !routeSlug) return;
    const key = `pda:last-project:${user.id}`;
    if (sessionStorage.getItem(key) !== routeSlug) {
      sessionStorage.setItem(key, routeSlug);
      window.dispatchEvent(new Event(selectionEvent));
    }
  }, [routeSlug, user?.id]);

  const sections = PROJECT_SECTIONS.filter(item => !("managerOnly" in item && item.managerOnly && !isManager));

  if (collapsed) {
    return (
      <div className="mt-3 space-y-0.5 border-t border-border pt-3">
        <Link
          href={projectPath ?? "/projects"}
          onClick={onNavigate}
          title={project?.name ?? t("chooseProject")}
          className="mb-1 flex items-center justify-center rounded-md py-2 hover:bg-muted"
        >
          <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-md bg-primary text-[11px] font-semibold text-primary-foreground">
            {project?.name?.slice(0, 1).toLocaleUpperCase() ?? "P"}
          </span>
        </Link>
        {projectPath &&
          sections.map(item => {
            const Icon = item.icon;
            const selected = !!routeSlug && active === item.value;
            return (
              <Link
                key={item.value}
                href={projectSectionHref(projectPath, item.value)}
                onClick={onNavigate}
                title={t(`tabs.${item.value}`)}
                aria-label={t(`tabs.${item.value}`)}
                aria-current={selected ? "page" : undefined}
                className={navItemClass(selected, "flex items-center justify-center rounded-md py-2 hover:bg-muted hover:text-foreground")}
              >
                <Icon size={17} weight={selected ? "fill" : "regular"} aria-hidden="true" />
              </Link>
            );
          })}
      </div>
    );
  }

  return (
    <div className="mt-3 border-t border-border pt-4">
      <div className="mb-2 flex items-center justify-between gap-2 px-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{t("selectedProject")}</p>
        {projectPath && pathname !== "/projects" && <Link href="/projects" onClick={onNavigate} className="text-[11px] font-medium text-muted-foreground hover:text-foreground hover:underline">{t("changeProject")}</Link>}
      </div>
      {projectPath ? (
        <Link href={projectPath} onClick={onNavigate} title={project?.name} className="mb-2 flex min-w-0 items-center gap-2.5 rounded-md border bg-card/60 px-2.5 py-2 text-[13px] font-semibold hover:bg-muted">
          <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-md bg-primary text-[11px] font-semibold text-primary-foreground">{project?.name?.slice(0, 1).toLocaleUpperCase() ?? "P"}</span>
          <span className="truncate">{project?.name ?? slug}</span>
        </Link>
      ) : (
        <Link href="/projects" onClick={onNavigate} className="mb-2 block rounded-md border border-dashed px-3 py-2 text-[12px] text-muted-foreground hover:bg-muted hover:text-foreground">{t("chooseProject")}</Link>
      )}
      <div className="ml-2 space-y-0.5 border-l border-border pl-2" aria-label={t("navigation")}>
        {sections.map(item => {
          const Icon = item.icon;
          const selected = !!routeSlug && active === item.value;
          const className = navItemClass(selected, cn("flex items-center gap-3 rounded-md px-3 py-2 text-[13px]", projectPath && "hover:bg-muted hover:text-foreground"));
          return (
            projectPath ? (
              <Link key={item.value} href={projectSectionHref(projectPath, item.value)} onClick={onNavigate} aria-current={selected ? "page" : undefined} className={className}>
                <Icon size={17} weight={selected ? "fill" : "regular"} aria-hidden="true" />
                {t(`tabs.${item.value}`)}
              </Link>
            ) : (
              <span key={item.value} aria-disabled="true" className={className}>
                <Icon size={17} aria-hidden="true" />{t(`tabs.${item.value}`)}
              </span>
            )
          );
        })}
      </div>
    </div>
  );
}

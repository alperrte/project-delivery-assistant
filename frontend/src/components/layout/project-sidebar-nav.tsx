"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "@phosphor-icons/react";
import { projectsApi } from "@/features/projects/api";
import { useCurrentMember } from "@/features/projects/hooks/use-current-member";
import { PROJECT_SECTIONS, projectSection, projectSectionHref } from "@/features/projects/project-sections";
import { cn } from "@/lib/utils";

export function ProjectSidebarNav({ onNavigate }: { onNavigate: () => void }) {
  const t = useTranslations("projects.detail");
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const slug = pathname.split("/")[2];
  const { data: project } = useQuery({
    queryKey: ["projects", "by-slug", slug],
    queryFn: () => projectsApi.bySlug(slug),
  });
  const { isManager } = useCurrentMember(project?.id ?? "");
  const active = projectSection(searchParams.get("section"), isManager);

  return (
    <div className="mt-2 border-t border-border pt-2">
      <Link href="/projects" onClick={onNavigate} className="mb-2 flex items-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
        <ArrowLeft size={15} aria-hidden="true" />{t("backToProjects")}
      </Link>
      {project && <p className="truncate px-3 pb-2 text-[11px] font-semibold text-muted-foreground" title={project.name}>{project.name}</p>}
      <div className="space-y-0.5" aria-label={t("navigation")}>
        {PROJECT_SECTIONS.filter(item => !("managerOnly" in item && item.managerOnly && !isManager)).map(item => {
          const Icon = item.icon;
          const selected = active === item.value;
          return (
            <Link
              key={item.value}
              href={projectSectionHref(pathname, item.value)}
              onClick={onNavigate}
              aria-current={selected ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                selected && "bg-accent font-semibold text-foreground",
              )}
            >
              <Icon size={17} weight={selected ? "fill" : "regular"} aria-hidden="true" />
              {t(`tabs.${item.value}`)}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

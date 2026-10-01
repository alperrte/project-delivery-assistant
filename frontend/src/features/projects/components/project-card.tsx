"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { CalendarBlank } from "@phosphor-icons/react";
import { EntityCard, EntityCardFooter, EntityCardLink, EntityCardSection, EntityStatusPill } from "@/components/common/entity-card";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";
import { projectsApi } from "../api";
import { parseTechStack } from "../tech-stack";
import type { Project } from "../types";
import {
  projectStatusBadgeClass,
  projectStatusDotClass,
  projectStatusTone,
  projectPriorityDotClass,
} from "../status-colors";

const MAX_TECH_CHIPS = 3;
const MAX_AVATARS = 4;

export function ProjectCard({ project }: { project: Project }) {
  const t = useTranslations("projects");
  const locale = useLocale();
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const href = `/projects/${project.slug}`;
  const tech = parseTechStack(project.techStack);
  // Same key as the dashboard, so both screens share one cached Project Home.
  const home = useQuery({
    queryKey: ["project-home", project.id],
    queryFn: () => projectsApi.home(project.id),
  });
  const managers = home.data?.managers ?? [];
  const memberCount = home.data?.teamMemberCount ?? 0;
  const shown = managers.slice(0, MAX_AVATARS);
  const extra = Math.max(memberCount - shown.length, 0);

  return (
    <EntityCard
      tone={projectStatusTone(project.status)}
      mark={project.name.slice(0, 1).toLocaleUpperCase(locale)}
      title={project.name}
      description={project.description || project.projectGoal || t("cardNoDescription")}
      badge={
        <EntityStatusPill
          className={projectStatusBadgeClass(project.status)}
          dotClassName={projectStatusDotClass(project.status)}
          label={t(`overview.statusValues.${project.status}`)}
        />
      }
    >
      <EntityCardSection label={t("card.technology")}>
        {tech.length === 0 ? (
          <p className="flex min-h-7 items-center text-sm text-muted-foreground">{t("card.noTechnology")}</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {tech.slice(0, MAX_TECH_CHIPS).map((item) => (
              <li key={item} className="max-w-full truncate rounded-md border bg-surface-2 px-2 py-1 text-xs font-medium text-foreground">{item}</li>
            ))}
            {tech.length > MAX_TECH_CHIPS && (
              <li className="rounded-md border bg-surface-2 px-2 py-1 text-xs text-muted-foreground" title={tech.slice(MAX_TECH_CHIPS).join(", ")}>
                +{tech.length - MAX_TECH_CHIPS}
              </li>
            )}
          </ul>
        )}
      </EntityCardSection>

      <EntityCardSection label={t("card.team")}>
        {home.isLoading ? (
          <Skeleton className="h-8 w-28" />
        ) : home.isError ? (
          <p className="flex min-h-8 items-center text-sm text-muted-foreground">{t("card.teamUnavailable")}</p>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2" aria-hidden="true">
              {shown.map((manager) => (
                <Avatar key={manager.userId} name={manager.nickname} className="bg-muted text-foreground" />
              ))}
              {extra > 0 && (
                <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium text-muted-foreground ring-2 ring-card">
                  +{extra}
                </span>
              )}
            </div>
            <span className="text-sm text-muted-foreground">{t("card.members", { count: memberCount })}</span>
          </div>
        )}
      </EntityCardSection>

      <EntityCardSection label={t("card.lastUpdate")}>
        <p className="flex items-center gap-2 text-sm text-foreground">
          <CalendarBlank size={16} className="text-muted-foreground" aria-hidden="true" />
          <time dateTime={project.updatedAt}>{date.format(new Date(project.updatedAt))}</time>
        </p>
      </EntityCardSection>

      <EntityCardFooter>
        <EntityCardLink href={href} label={t("card.open")} ariaLabel={t("card.openNamed", { name: project.name })} />
      </EntityCardFooter>
    </EntityCard>
  );
}

export function ProjectRow({ project }: { project: Project }) {
  const t = useTranslations("projects");
  const locale = useLocale();
  const router = useRouter();
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  return (
    <TableRow
      className="cursor-pointer"
      onClick={() => router.push(`/projects/${project.slug}`)}
    >
      <TableCell className="whitespace-normal">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center rounded-lg border border-primary/25 bg-primary/10 font-heading text-sm font-semibold text-primary"
          >
            {project.name.slice(0, 1).toLocaleUpperCase(locale)}
          </span>
          <div className="min-w-0">
            <Link
              href={`/projects/${project.slug}`}
              onClick={(event) => event.stopPropagation()}
              className="block truncate text-sm font-medium text-foreground hover:text-primary hover:underline"
            >
              {project.name}
            </Link>
            <p className="truncate text-xs text-muted-foreground">
              {project.description || project.projectGoal || t("cardNoDescription")}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
          <span className={`size-2 shrink-0 rounded-full ${projectStatusDotClass(project.status)}`} aria-hidden="true" />
          {t(`overview.statusValues.${project.status}`)}
        </span>
      </TableCell>
      <TableCell>
        <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
          <span className={`size-2 shrink-0 rounded-full ${projectPriorityDotClass(project.priority)}`} aria-hidden="true" />
          {t(`overview.priorityValues.${project.priority}`)}
        </span>
      </TableCell>
      <TableCell className="text-muted-foreground">{project.techStack || "—"}</TableCell>
      <TableCell className="text-right text-muted-foreground">{date.format(new Date(project.updatedAt))}</TableCell>
    </TableRow>
  );
}

"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ArrowUpRight, CalendarBlank } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import type { Project } from "../types";

export function ProjectCard({ project }: { project: Project }) {
  const t = useTranslations("projects");
  const locale = useLocale();
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  return (
    <Link
      href={`/projects/${project.slug}`}
      aria-label={project.name}
      className="group grid overflow-hidden rounded-3xl border bg-card shadow-sm transition-all hover:border-primary/50 hover:shadow-[0_18px_50px_-28px_var(--primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:grid-cols-[minmax(0,1.35fr)_minmax(17rem,.65fr)]"
    >
      <div className="relative flex min-w-0 flex-col justify-between gap-8 p-6 sm:p-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{t("cardLabel")}</p>
          <h2 className="mt-3 font-heading text-2xl font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary sm:text-3xl">
            {project.name}
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
            {project.description || project.projectGoal || t("cardNoDescription")}
          </p>
        </div>
        {project.projectGoal && project.description && (
          <p className="max-w-3xl border-l-2 border-primary/50 pl-4 text-sm text-foreground/85">
            <span className="mr-2 font-medium text-muted-foreground">{t("cardGoal")}</span>{project.projectGoal}
          </p>
        )}
      </div>

      <div className="flex min-w-0 flex-col justify-between gap-8 border-t bg-muted/20 p-6 sm:p-8 lg:border-t-0 lg:border-l">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="px-2.5 py-1">{t(`overview.statusValues.${project.status}`)}</Badge>
            <Badge variant="secondary" className="px-2.5 py-1">{t(`overview.priorityValues.${project.priority}`)}</Badge>
          </div>
          <ArrowUpRight size={20} className="shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
        </div>
        <div className="space-y-2 text-sm">
          {project.targetEndDate && (
            <p className="flex items-center gap-2 text-foreground/85">
              <CalendarBlank size={17} className="text-muted-foreground" aria-hidden="true" />
              {t("overview.due", { date: date.format(new Date(project.targetEndDate)) })}
            </p>
          )}
          {project.techStack && <p className="line-clamp-1 text-muted-foreground">{project.techStack}</p>}
          <p className="text-xs text-muted-foreground">{t("cardUpdated", { date: date.format(new Date(project.updatedAt)) })}</p>
        </div>
      </div>
    </Link>
  );
}

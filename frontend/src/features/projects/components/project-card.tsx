"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { TableCell, TableRow } from "@/components/ui/table";
import type { Project } from "../types";
import { projectStatusDotClass, projectPriorityDotClass } from "../status-colors";

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

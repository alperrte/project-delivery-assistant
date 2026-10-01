"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, CalendarBlank, PencilSimple, TreeStructure } from "@phosphor-icons/react";
import { AvatarStack } from "@/components/common/avatar-stack";
import { EntityCard, EntityCardFooter, EntityCardLink, EntityCardSection } from "@/components/common/entity-card";
import { buttonVariants } from "@/components/ui/button";
import { ProjectMark } from "@/features/projects/components/project-card";
import type { Project } from "@/features/projects/types";
import { cn } from "@/lib/utils";
import { projectLogoSrc } from "../hooks";
import { relativeTime } from "../relative-time";
import type { Team } from "../types";
import { ArchiveTeamButton } from "./archive-team-button";

type TeamCardProject = Pick<Project, "id" | "slug" | "name" | "logoVersion">;

/** Live preview on the form: no links or actions, and the logo / time labels are supplied by the caller. */
export type TeamCardPreview = { logoSrc: string | null; updatedLabel: string; joinedLabel: string | null };

export function TeamCard({
  team,
  project,
  parentName,
  canManage,
  preview,
}: {
  team: Team;
  project: TeamCardProject;
  parentName?: string | null;
  canManage?: boolean;
  preview?: TeamCardPreview;
}) {
  const t = useTranslations("squads.card");
  const locale = useLocale();
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const logo = preview ? preview.logoSrc : projectLogoSrc(project);
  const when = preview?.updatedLabel ?? date.format(new Date(team.updatedAt));
  const updated = team.updatedBy ? t("updatedBy", { date: when, name: team.updatedBy.nickname }) : when;
  const joined = team.lastJoined
    ? t("joinedBy", {
        name: team.lastJoined.nickname ?? "?",
        when: preview?.joinedLabel ?? relativeTime(team.lastJoined.joinedAt, locale),
      })
    : null;
  const base = `/projects/${project.slug}/teams/${team.id}`;
  const name = team.name.trim() || t("namePlaceholder");

  return (
    <EntityCard
      mark={<ProjectMark key={logo ?? "none"} name={project.name} src={logo} />}
      title={name}
      description={team.description || t("noDescription")}
      badge={
        parentName ? (
          <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground">
            <TreeStructure size={13} className="shrink-0" aria-hidden="true" />
            <span className="truncate">{t("parent", { name: parentName })}</span>
          </span>
        ) : undefined
      }
      className={preview ? "hover:translate-y-0 hover:border-border hover:shadow-none motion-safe:hover:translate-y-0" : undefined}
    >
      <EntityCardSection label={t("members")}>
        {team.memberCount === 0 ? (
          <p className="flex min-h-8 items-center text-sm text-muted-foreground">{t("noMembers")}</p>
        ) : (
          <div className="flex items-center gap-3">
            <AvatarStack people={team.memberPreview} total={team.memberCount} />
            <span className="text-sm text-muted-foreground">{t("memberCount", { count: team.memberCount })}</span>
          </div>
        )}
      </EntityCardSection>

      <EntityCardSection label={t("lastUpdate")}>
        <p className="flex items-center gap-2 text-sm text-foreground">
          <CalendarBlank size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="min-w-0 truncate" title={updated}>{updated}</span>
        </p>
      </EntityCardSection>

      <EntityCardSection label={t("lastJoined")}>
        <p className={cn("truncate text-sm", joined ? "text-foreground" : "text-muted-foreground")} title={joined ?? undefined}>
          {joined ?? t("nobodyJoined")}
        </p>
      </EntityCardSection>

      <EntityCardFooter>
        {preview ? (
          <span
            aria-disabled="true"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "min-w-0 flex-1 justify-between px-3 opacity-60")}
          >
            {t("open")}
            <ArrowRight size={16} aria-hidden="true" />
          </span>
        ) : (
          <>
            <EntityCardLink href={base} label={t("open")} ariaLabel={t("openNamed", { name })} />
            {canManage && (
              <>
                <Link
                  href={`${base}/edit`}
                  className={cn(buttonVariants({ variant: "outline", size: "icon" }), "relative z-10")}
                  aria-label={t("editNamed", { name })}
                  title={t("edit")}
                >
                  <PencilSimple size={16} aria-hidden="true" />
                </Link>
                <ArchiveTeamButton projectId={project.id} teamId={team.id} teamName={name} />
              </>
            )}
          </>
        )}
      </EntityCardFooter>
    </EntityCard>
  );
}

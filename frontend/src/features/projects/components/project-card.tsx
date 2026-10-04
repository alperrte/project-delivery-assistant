"use client";

import Link from "@/i18n/navigation";
import { useRouter } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, CalendarBlank, PencilSimple } from "@phosphor-icons/react";
import { EntityCard, EntityCardFooter, EntityCardLink, EntityCardSection, EntityStatusPill } from "@/components/common/entity-card";
import { AvatarStack } from "@/components/common/avatar-stack";
import { buttonVariants } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { projectBannerUrl, projectLogoSource } from "../api";
import { parseTechStack } from "../tech-stack";
import type { Project, ProjectType } from "../types";
import {
  projectStatusBadgeClass,
  projectStatusDotClass,
  projectStatusTone,
  projectPriorityDotClass,
} from "../status-colors";
import { ProjectMark } from "./project-mark";
import { ProjectBanner } from "./project-banner";
import { ProjectTypeBadge } from "./project-type";
import { TechLogo, toTechLabels } from "./tech-logo";

const MAX_TECH_LOGOS = 6;

export type ProjectCardData = Pick<
  Project,
  "id" | "slug" | "name" | "tagline" | "description" | "projectGoal" | "status" | "techStack" | "logoVersion" | "team" | "updatedBy" | "updatedAt"
> & {
  /** `null` only in the create preview, before a type has been picked. */
  projectType: ProjectType | null;
  /** Epoch ms of the banner; absent in the create preview, where no banner exists yet. */
  bannerVersion?: number | null;
  /** The signed-in user may open this project's settings; only the project list tells. */
  canEdit?: boolean | null;
};

/** Live preview on the create page: the link is inert and the logo comes from the file the user just picked. */
export type ProjectCardPreview = { logoSrc: string | null; bannerSrc?: string | null; updatedLabel: string };

const techChip = "relative z-10 inline-flex h-8 min-w-8 items-center justify-center rounded-md border bg-surface-2 px-1.5 text-xs font-medium text-muted-foreground";

function logoSource(project: Pick<Project, "id" | "logoVersion">, preview?: ProjectCardPreview,
                    invitationLogoSrc?: string | null): string | null {
  if (preview) return preview.logoSrc;
  if (invitationLogoSrc !== undefined) return invitationLogoSrc;
  return projectLogoSource(project);
}

/**
 * The banner shows on the card in the Projeler list and, as the user picks it, on the create page's preview card; the
 * invitation preview never has one.
 */
function bannerSource(project: Pick<ProjectCardData, "id" | "bannerVersion">, preview?: ProjectCardPreview,
                      invitation?: boolean): string | null {
  if (preview) return preview.bannerSrc ?? null;
  if (invitation || project.bannerVersion == null) return null;
  return projectBannerUrl(project.id, project.bannerVersion);
}

/** Logos only; the name lives in a tooltip and in the accessible label. Free text from older projects stays a text chip. */
function TechStrip({ labels }: { labels: string[] }) {
  const t = useTranslations("projects.card");
  const items = toTechLabels(labels);
  const shown = items.slice(0, MAX_TECH_LOGOS);
  const rest = items.slice(MAX_TECH_LOGOS);
  const restNames = rest.map(({ label, tech }) => tech?.name ?? label).join(", ");

  return (
    <ul aria-label={t("technology")} className="flex flex-wrap items-center gap-1.5">
      {shown.map(({ label, tech }) => (
        <li key={label}>
          {tech ? (
            <Tooltip>
              <TooltipTrigger render={<span role="img" aria-label={tech.name} className={techChip} />}>
                <TechLogo tech={tech} />
              </TooltipTrigger>
              <TooltipContent>{tech.name}</TooltipContent>
            </Tooltip>
          ) : (
            <span className={cn(techChip, "max-w-32 justify-start truncate")} title={label}>{label}</span>
          )}
        </li>
      ))}
      {rest.length > 0 && (
        <li>
          <Tooltip>
            <TooltipTrigger render={<span role="img" aria-label={restNames} className={techChip} />}>+{rest.length}</TooltipTrigger>
            <TooltipContent>{restNames}</TooltipContent>
          </Tooltip>
        </li>
      )}
    </ul>
  );
}

export function ProjectCard({ project, preview, invitationPreview }: {
  project: ProjectCardData;
  preview?: ProjectCardPreview;
  /** Recipient-scoped logo URL. The invitation view never renders the project-open action. */
  invitationPreview?: { logoSrc: string | null };
}) {
  const t = useTranslations("projects");
  const locale = useLocale();
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const tech = parseTechStack(project.techStack);
  const team = project.team;
  const when = preview?.updatedLabel ?? date.format(new Date(project.updatedAt));
  const updated = project.updatedBy ? t("card.updatedBy", { date: when, name: project.updatedBy.nickname }) : when;
  const logo = logoSource(project, preview, invitationPreview?.logoSrc);
  const banner = bannerSource(project, preview, !!invitationPreview);

  return (
    <EntityCard
      tone={projectStatusTone(project.status)}
      banner={banner ? <ProjectBanner key={banner} src={banner} className="aspect-auto size-full sm:aspect-auto" /> : undefined}
      corner={!preview && !invitationPreview && project.canEdit ? (
        <Link
          href={`/projects/${project.slug}?section=settings`}
          aria-label={t("card.editNamed", { name: project.name })}
          title={t("card.edit")}
          className={cn(buttonVariants({ variant: "outline", size: "icon" }), "size-11 bg-background/90 shadow-sm backdrop-blur sm:size-9")}
        >
          <PencilSimple size={18} aria-hidden="true" />
        </Link>
      ) : undefined}
      mark={<ProjectMark key={logo ?? "none"} name={project.name} src={logo} />}
      title={project.name}
      description={project.tagline || project.description || project.projectGoal || t("cardNoDescription")}
      badge={
        <div className="flex flex-wrap justify-center gap-1.5">
          <EntityStatusPill
            className={projectStatusBadgeClass(project.status)}
            dotClassName={projectStatusDotClass(project.status)}
            label={t(`overview.statusValues.${project.status}`)}
          />
          {project.projectType && (
            <ProjectTypeBadge type={project.projectType} label={t(`card.types.${project.projectType}`)} />
          )}
        </div>
      }
      className={preview || invitationPreview ? "hover:translate-y-0 hover:border-border hover:shadow-none motion-safe:hover:translate-y-0" : undefined}
    >
      <EntityCardSection label={t("card.technology")}>
        {tech.length === 0 ? (
          <p className="flex min-h-8 items-center text-sm text-muted-foreground">{t("card.noTechnology")}</p>
        ) : (
          <TechStrip labels={tech} />
        )}
      </EntityCardSection>

      {team && (
        <EntityCardSection label={t("card.team")}>
          <div className="flex items-center gap-3">
            <AvatarStack people={team.preview} total={team.memberCount} />
            <span className="text-sm text-muted-foreground">{t("card.members", { count: team.memberCount })}</span>
          </div>
        </EntityCardSection>
      )}

      <EntityCardSection label={t("card.lastUpdate")}>
        <p className="flex items-center gap-2 text-sm text-foreground">
          <CalendarBlank size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="min-w-0 truncate" title={updated}>{updated}</span>
        </p>
      </EntityCardSection>

      {!invitationPreview && <EntityCardFooter>
        {preview ? (
          <span
            aria-disabled="true"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "min-w-0 flex-1 justify-between px-3 opacity-60")}
          >
            {t("card.open")}
            <ArrowRight size={16} aria-hidden="true" />
          </span>
        ) : (
          <EntityCardLink
            href={`/projects/${project.slug}`}
            label={t("card.open")}
            ariaLabel={t("card.openNamed", { name: project.name })}
          />
        )}
      </EntityCardFooter>}
    </EntityCard>
  );
}

export function ProjectRow({ project }: { project: Project }) {
  const t = useTranslations("projects");
  const locale = useLocale();
  const router = useRouter();
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const logo = logoSource(project);

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
            <ProjectMark key={logo ?? "none"} name={project.name} src={logo} />
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
              {project.tagline || project.description || project.projectGoal || t("cardNoDescription")}
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
      <TableCell className="text-muted-foreground">{t(`card.types.${project.projectType}`)}</TableCell>
      <TableCell className="text-muted-foreground">{project.techStack || "—"}</TableCell>
      <TableCell className="text-right text-muted-foreground">{date.format(new Date(project.updatedAt))}</TableCell>
    </TableRow>
  );
}

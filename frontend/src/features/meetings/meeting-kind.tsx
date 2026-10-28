"use client";
import { useTranslations } from "next-intl";
import { FolderKanban, Video } from "lucide-react";
import Link from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { projectLogoSource } from "@/features/projects/api";
import { ProjectMark } from "@/features/projects/components/project-mark";
import type { Meeting, MeetingProject } from "./types";

/** The project's logo tile (or its first letter) followed by its name. */
export function ProjectChip({ project, href, className }: { project: Pick<MeetingProject, "id" | "name" | "logoVersion" | "logoShape" | "slug">; href?: boolean; className?: string }) {
  const body = <>
    <span data-logo-frame aria-hidden="true" className="grid size-5 shrink-0 place-items-center rounded bg-primary text-[10px] font-semibold text-primary-foreground">
      <ProjectMark shape={project.logoShape ?? "SQUARE"} name={project.name} src={projectLogoSource({ id: project.id, logoVersion: project.logoVersion })} />
    </span>
    <span data-meeting-project-name className="min-w-0 break-words">{project.name}</span>
  </>;
  const style = cn("inline-flex min-w-0 items-center gap-1.5 text-sm", className);
  return href ? <Link href={`/projects/${project.slug}`} className={cn(style, "font-medium underline-offset-4 hover:underline")}>{body}</Link> : <span className={style}>{body}</span>;
}

/** "Project meeting" / "Independent meeting" label. The text always says it; the colour only reinforces it. */
export function MeetingKindBadge({ meeting, className }: { meeting: Pick<Meeting, "meetingType">; className?: string }) {
  const t = useTranslations("meetings");
  const project = meeting.meetingType === "PROJECT";
  const Icon = project ? FolderKanban : Video;
  return <span data-meeting-kind={meeting.meetingType} className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", project ? "bg-meeting-soft text-meeting-ink" : "bg-muted text-muted-foreground", className)}>
    <Icon size={12} aria-hidden="true" />{t(project ? "kindProject" : "kindIndependent")}<span className="sr-only">. </span>
  </span>;
}

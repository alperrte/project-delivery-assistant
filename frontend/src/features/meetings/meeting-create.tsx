"use client";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ArrowRight, FolderKanban, Video } from "lucide-react";
import Link, { useSearchParams } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { projectLogoSource, projectsApi } from "@/features/projects/api";
import { ProjectMark } from "@/features/projects/components/project-mark";
import type { Project } from "@/features/projects/types";
import { cn } from "@/lib/utils";
import { MeetingForm } from "./meeting-form";
import { MeetingError, useMeetingAccount } from "./shared";

const INDEPENDENT = "/meetings/new?type=independent", PROJECT = "/meetings/new?type=project";
const card = "group workspace-panel flex flex-col gap-4 p-6 text-left outline-none transition-colors hover:border-primary/50 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring active:bg-muted/60";

/** The card is ONE link whose name is its title and the sentence under it. The two sit in separate blocks, so a reader would join them into one word ("OluşturProjelerinizden"): a spoken full stop between them keeps them apart. */
function KindCard({ href, icon, title, description, kind }: { href: string; icon: React.ReactNode; title: string; description: string; kind: string }) {
  return <Link href={href} data-meeting-kind-choice={kind} className={card}>
    <span aria-hidden="true" className="grid size-12 place-items-center rounded-xl bg-meeting-soft text-meeting-ink transition-colors group-hover:bg-meeting group-hover:text-meeting-foreground">{icon}</span>
    <span className="space-y-1.5"><span className="block text-lg font-semibold leading-6">{title}<span className="sr-only">. </span></span><span className="block text-sm leading-6 text-muted-foreground">{description}</span></span>
    <span aria-hidden="true" className="mt-auto flex justify-end text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"><ArrowRight size={18} /></span>
  </Link>;
}

/** The first step of "Create meeting": a project meeting or an independent one. Two plain links, so Back, reload and a typed address all work. */
function MeetingKindChooser() {
  const t = useTranslations("meetings");
  return <PageContainer width="form">
    <PageHeader title={t("create")} description={t("chooseKindDescription")} />
    <div className="grid gap-4 md:grid-cols-2" role="group" aria-label={t("chooseKind")}>
      <KindCard kind="project" href={PROJECT} icon={<FolderKanban size={24} />} title={t("createProjectMeeting")} description={t("createProjectMeetingDescription")} />
      <KindCard kind="independent" href={INDEPENDENT} icon={<Video size={24} />} title={t("createIndependentMeeting")} description={t("createIndependentMeetingDescription")} />
    </div>
  </PageContainer>;
}

/** The projects the user can see (the server decides again when the meeting is saved; an unauthorized project is refused there). */
function useMyProjects() {
  const context = useMeetingAccount();
  return useQuery({ queryKey: [...context.keys, "my-projects"], enabled: !!context.user, staleTime: 30_000, retry: false, queryFn: ({ signal }) => projectsApi.allVisible(signal) });
}

function ProjectPicker() {
  const t = useTranslations("meetings"), projects = useMyProjects();
  const list = (projects.data ?? []).filter(project => project.status !== "ARCHIVED");
  return <PageContainer width="form">
    <PageHeader title={t("chooseProject")} description={t("chooseProjectDescription")} />
    {projects.isError ? <MeetingError error={projects.error} retry={() => void projects.refetch()} />
      : projects.isPending ? <div role="status" aria-label={t("loading")} className="grid gap-3 sm:grid-cols-2">{[0, 1, 2, 3].map(index => <Skeleton key={index} className="h-24 rounded-xl" />)}</div>
      : !list.length ? <EmptyState title={t("noProjects")} description={t("noProjectsHint")} action={<Link href={INDEPENDENT} className={buttonVariants({ variant: "accent" })}>{t("createIndependentMeeting")}</Link>} />
      : <ul aria-label={t("projects")} className="grid gap-3 sm:grid-cols-2">{list.map(project => <li key={project.id}>
        <Link href={`${PROJECT}&project=${project.id}`} data-meeting-project-choice={project.id} className={cn(card, "h-full flex-row items-start gap-4 p-4")}>
          <span data-logo-frame aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground"><ProjectMark shape={project.logoShape} name={project.name} src={projectLogoSource(project)} /></span>
          <span className="min-w-0 space-y-1"><span className="block break-words text-base font-semibold leading-6">{project.name}{project.description && <span className="sr-only">. </span>}</span>
            {project.description && <span className="line-clamp-2 block text-sm leading-5 text-muted-foreground">{project.description}</span>}</span>
        </Link></li>)}</ul>}
  </PageContainer>;
}

function ProjectMeeting({ projectId }: { projectId: string }) {
  const t = useTranslations("meetings"), projects = useMyProjects();
  const project: Project | undefined = projects.data?.find(item => item.id === projectId && item.status !== "ARCHIVED");
  if (projects.isError) return <MeetingError error={projects.error} retry={() => void projects.refetch()} />;
  if (projects.isPending) return <p role="status">{t("loading")}</p>;
  if (!project) return <PageContainer width="form"><div role="alert" className="workspace-panel space-y-4 p-6 text-sm"><p>{t("projectUnavailable")}</p>
    <Link href={PROJECT} className={buttonVariants({ variant: "outline", className: "min-h-11" })}>{t("chooseAnotherProject")}</Link></div></PageContainer>;
  return <MeetingForm key={project.id} project={{ id: project.id, slug: project.slug, name: project.name, logoVersion: project.logoVersion ?? null, logoShape: project.logoShape ?? null }} />;
}

/** `/meetings/new`: choose the kind, then (for a project meeting) the project, then the one meeting form. */
export function MeetingCreate() {
  const params = useSearchParams(), type = params.get("type"), projectId = params.get("project");
  if (type === "independent") return <MeetingForm />;
  if (type === "project") return projectId ? <ProjectMeeting projectId={projectId} /> : <ProjectPicker />;
  return <MeetingKindChooser />;
}

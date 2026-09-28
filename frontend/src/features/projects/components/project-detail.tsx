"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowLeft, ChartBar, CheckCircle, Users, EnvelopeSimple,
  UsersThree, GithubLogo, GearSix, CalendarBlank, Code, PencilSimple, Stack,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { errorKey } from "@/lib/api/error-message";
import { MemberList } from "@/features/projects/components/members/member-list";
import { InvitationsPanel } from "@/features/invitations/components/invitations-panel";
import { SquadList } from "@/features/squads/components/squad-list";
import { CriteriaList } from "@/features/criteria/components/criteria-list";
import { RepositorySettings } from "@/features/repository/components/repository-settings";
import { projectsApi } from "../api";
import { useCurrentMember } from "../hooks/use-current-member";
import { ProjectOverview } from "./project-overview";
import { ProjectSettingsForm } from "./project-settings-form";

const SECTIONS = [
  { value: "overview", icon: ChartBar },
  { value: "criteria", icon: CheckCircle },
  { value: "members", icon: Users },
  { value: "invitations", icon: EnvelopeSimple, managerOnly: true },
  { value: "squads", icon: UsersThree },
  { value: "repository", icon: GithubLogo },
  { value: "settings", icon: GearSix, managerOnly: true },
] as const;

type Section = (typeof SECTIONS)[number]["value"];

export function ProjectDetail({ slug }: { slug: string }) {
  const t = useTranslations("projects.detail");
  const tp = useTranslations("projects.overview");
  const te = useTranslations("errors");
  const locale = useLocale();
  const [section, setSection] = useState<Section>("overview");

  const { data: project, isLoading, isError, error } = useQuery({
    queryKey: ["projects", "by-slug", slug],
    queryFn: () => projectsApi.bySlug(slug),
  });

  const { isManager, isLoading: memberLoading } = useCurrentMember(project?.id ?? "");
  const { data: home } = useQuery({
    queryKey: ["projects", project?.id, "home"],
    queryFn: () => projectsApi.home(project!.id),
    enabled: !!project,
  });

  if (isLoading || memberLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (isError) return <p className="text-sm text-destructive">{te(errorKey(error))}</p>;
  if (!project) return null;

  const visibleSections = SECTIONS.filter((item) => !("managerOnly" in item && item.managerOnly && !isManager));

  return (
    <Tabs value={section} onValueChange={(value) => setSection(value as Section)} orientation="vertical" className="project-workspace grid min-w-0 gap-5 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)] lg:gap-7">
        <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start lg:rounded-2xl lg:border lg:bg-card/55 lg:p-4 lg:pb-8 lg:shadow-sm">
          <Link href="/projects" className="mb-5 hidden items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:inline-flex">
            <ArrowLeft size={15} aria-hidden="true" />{t("backToProjects")}
          </Link>
          <div className="lg:hidden">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{t("navigation")}</p>
            <Select value={section} onValueChange={(value) => setSection(value as Section)}>
              <SelectTrigger aria-label={t("navigation")} className="h-11 w-full border-border bg-card px-3">
                <SelectValue>{(value: Section) => t(`tabs.${value}`)}</SelectValue>
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {visibleSections.map((item) => (
                  <SelectItem key={item.value} value={item.value} className="py-2.5">
                    {t(`tabs.${item.value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="hidden lg:block">
            <p className="mb-3 px-3 text-[0.68rem] font-bold uppercase tracking-[0.17em] text-primary">{t("eyebrow")}</p>
            <TabsList className="h-auto w-full max-w-none flex-col items-stretch gap-1 overflow-visible bg-transparent p-0">
              {visibleSections.map((item) => {
                const Icon = item.icon;
                return (
                  <TabsTrigger key={item.value} value={item.value} className="h-11 flex-none justify-start gap-3 rounded-lg border border-transparent px-3 text-[0.88rem] font-medium text-muted-foreground transition-all hover:bg-muted hover:text-foreground data-active:border-primary/55 data-active:bg-primary/15 data-active:text-foreground data-active:shadow-[inset_3px_0_0_var(--primary)]">
                    <Icon size={18} aria-hidden="true" />
                    {t(`tabs.${item.value}`)}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>
        </aside>

        <div className="min-w-0 space-y-6">
          <div className="flex flex-wrap items-start gap-4 sm:gap-5">
            <div className="grid size-16 shrink-0 place-items-center rounded-xl border border-primary/35 bg-primary/15 text-primary shadow-[inset_0_1px_0_rgb(255_255_255/0.1)] sm:size-18">
              <Stack size={34} weight="duotone" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <h1 className="font-heading text-[1.65rem] font-bold leading-tight text-foreground sm:text-[2rem]">{project.name}</h1>
                <Badge className={project.status === "ACTIVE" || project.status === "COMPLETED" ? "border border-success/25 bg-success/10 px-2.5 py-0.5 text-success" : project.status === "ON_HOLD" ? "border border-warning/25 bg-warning/10 px-2.5 py-0.5 text-warning" : "border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-primary"}>{tp(`statusValues.${project.status}`)}</Badge>
                <Badge className="border border-warning/25 bg-warning/10 px-2.5 py-0.5 text-warning">{tp(`priorityValues.${project.priority}`)}</Badge>
              </div>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">{project.description || project.projectGoal || tp("noGoal")}</p>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><CalendarBlank size={15} aria-hidden="true" />{t("createdAt", { date: new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(project.createdAt)) })}</span>
                {home && <span className="inline-flex items-center gap-1.5"><Users size={15} aria-hidden="true" />{tp("teamMembers", { count: home.teamMemberCount })}</span>}
                <span className="inline-flex items-center gap-1.5"><Code size={15} aria-hidden="true" />{home?.repository.connected ? `${home.repository.repositoryOwner}/${home.repository.repositoryName}` : tp("noRepository")}</span>
              </div>
            </div>
            {isManager && <Button variant="outline" className="order-3 h-9 w-full sm:order-none sm:w-auto" onClick={() => setSection("settings")}><PencilSimple size={16} />{t("edit")}</Button>}
          </div>
          <TabsContent value="overview"><ProjectOverview project={project} isManager={isManager} onNavigate={setSection} /></TabsContent>
          <TabsContent value="criteria"><CriteriaList projectId={project.id} isManager={isManager} /></TabsContent>
          <TabsContent value="members"><MemberList projectId={project.id} isManager={isManager} /></TabsContent>
          {isManager && <TabsContent value="invitations"><InvitationsPanel projectId={project.id} /></TabsContent>}
          <TabsContent value="squads"><SquadList projectId={project.id} isManager={isManager} /></TabsContent>
          <TabsContent value="repository"><RepositorySettings projectId={project.id} isManager={isManager} /></TabsContent>
          {isManager && <TabsContent value="settings"><ProjectSettingsForm project={project} /></TabsContent>}
        </div>
      </Tabs>
  );
}

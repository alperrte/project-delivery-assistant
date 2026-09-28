"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  ArrowLeft, ChartBar, CheckCircle, Users, EnvelopeSimple,
  UsersThree, GithubLogo, GearSix,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
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
  const [section, setSection] = useState<Section>("overview");

  const { data: project, isLoading, isError, error } = useQuery({
    queryKey: ["projects", "by-slug", slug],
    queryFn: () => projectsApi.bySlug(slug),
  });

  const { isManager } = useCurrentMember(project?.id ?? "");

  if (isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (isError) return <p className="text-sm text-destructive">{te(errorKey(error))}</p>;
  if (!project) return null;

  const visibleSections = SECTIONS.filter((item) => !("managerOnly" in item && item.managerOnly && !isManager));

  return (
    <div className="space-y-7">
      <div className="space-y-4">
        <Link href="/projects" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft size={16} aria-hidden="true" />
          {t("backToProjects")}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-6">
          <div className="min-w-0 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{t("eyebrow")}</p>
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{project.name}</h1>
            {(project.description || project.projectGoal) && (
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{project.description || project.projectGoal}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant="outline" className="px-2.5 py-1">{tp(`statusValues.${project.status}`)}</Badge>
            <Badge variant="secondary" className="px-2.5 py-1">{tp(`priorityValues.${project.priority}`)}</Badge>
          </div>
        </div>
      </div>

      <Tabs value={section} onValueChange={(value) => setSection(value as Section)} orientation="vertical" className="grid min-w-0 gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10">
        <div className="min-w-0 lg:sticky lg:top-28 lg:self-start">
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
            <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{t("navigation")}</p>
            <TabsList className="h-auto w-full max-w-none flex-col items-stretch gap-1 overflow-visible bg-transparent p-0">
              {visibleSections.map((item) => {
                const Icon = item.icon;
                return (
                  <TabsTrigger key={item.value} value={item.value} className="h-10 flex-none justify-start gap-3 px-3 text-sm data-active:bg-primary/10 data-active:text-primary dark:data-active:bg-primary/15">
                    <Icon size={18} aria-hidden="true" />
                    {t(`tabs.${item.value}`)}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>
        </div>

        <div className="min-w-0">
          <TabsContent value="overview"><ProjectOverview project={project} isManager={isManager} onNavigate={setSection} /></TabsContent>
          <TabsContent value="criteria"><CriteriaList projectId={project.id} isManager={isManager} /></TabsContent>
          <TabsContent value="members"><MemberList projectId={project.id} isManager={isManager} /></TabsContent>
          {isManager && <TabsContent value="invitations"><InvitationsPanel projectId={project.id} /></TabsContent>}
          <TabsContent value="squads"><SquadList projectId={project.id} isManager={isManager} /></TabsContent>
          <TabsContent value="repository"><RepositorySettings projectId={project.id} isManager={isManager} /></TabsContent>
          {isManager && <TabsContent value="settings"><ProjectSettingsForm project={project} /></TabsContent>}
        </div>
      </Tabs>
    </div>
  );
}

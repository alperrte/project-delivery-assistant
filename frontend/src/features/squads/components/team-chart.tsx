"use client";

import { useId, useState } from "react";
import Link from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { CaretDown } from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { profilePhotoSrc } from "@/features/account/api";
import { useSession } from "@/features/auth/hooks/use-session";
import { ProjectMark } from "@/features/projects/components/project-mark";
import { PROJECT_ROLES, type Project } from "@/features/projects/types";
import { errorKey } from "@/lib/api/error-message";
import { hasBlockingError } from "@/lib/api/live-sync";
import { projectLogoSrc, teamsKey } from "../hooks";
import { loadOrganization } from "../organization-api";
import { buildOrganization, type OrganizationNode, type OrganizationPerson } from "../organization";
import type { Team } from "../types";

type ChartProject = Pick<Project, "id" | "slug" | "name" | "logoVersion" | "logoShape">;

function People({ people, project }: { people: OrganizationPerson[]; project: ChartProject }) {
  const t = useTranslations("squads.chart");
  const roles = useTranslations("roles");
  if (!people.length) return <p className="py-3 text-sm text-muted-foreground">{t("emptyMembers")}</p>;
  return <ul className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-3" aria-label={t("people")}>
    {people.map(person => {
      const name = person.nickname ?? person.userId;
      return <li key={person.userId} data-org-person={person.userId} className="flex min-w-0 items-start gap-2.5 rounded-md border bg-card p-2 sm:p-3">
        <Avatar name={name} src={profilePhotoSrc(person.userId, person.profilePhotoVersion)} className="size-8 bg-muted text-foreground ring-0" />
        <div className="min-w-0 flex-1 text-xs">
          <p className="text-sm font-medium text-foreground [overflow-wrap:anywhere]">{name}</p>
          <ul className="mt-1 flex flex-wrap gap-x-2 gap-y-1" aria-label={t("roles")}>
            {PROJECT_ROLES.filter(role => person.roles.includes(role)).map(role => <li key={role} className={role === "PROJECT_MANAGER" ? "font-medium text-foreground" : "text-muted-foreground"}>{roles(role)}</li>)}
          </ul>
          <p className="mt-2 text-muted-foreground">{t("teamMemberships")}</p>
          {person.teams.length ? <ul className="mt-0.5 flex flex-wrap gap-x-2 gap-y-1">{person.teams.map(team => <li key={team.id} className="min-w-0"><Link href={`/projects/${project.slug}/teams/${team.id}`} className="inline-flex min-h-6 items-center text-foreground underline-offset-2 hover:underline [overflow-wrap:anywhere]">{team.name}</Link></li>)}</ul>
            : <p className="mt-0.5 text-muted-foreground">{t("unassigned")}</p>}
        </div>
      </li>;
    })}
  </ul>;
}

function Disclosure({ label, count, open, onToggle, children, testId, compact = false }: { label: string; count: number; open: boolean; onToggle: () => void; children: React.ReactNode; testId?: string; compact?: boolean }) {
  const id = useId();
  return <div className="min-w-0" data-org-section={testId}>
    <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={id} className={`flex min-h-11 w-full min-w-0 items-center gap-2 rounded-md ${compact ? "px-0" : "px-0 sm:px-2"} py-2 text-left text-sm font-semibold hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`}>
      <CaretDown size={16} aria-hidden="true" className={`shrink-0 ${open ? "" : "-rotate-90"}`} />
      <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{label}</span><span className="shrink-0 text-xs font-normal tabular-nums text-muted-foreground">{count}</span>
    </button>
    <div id={id} hidden={!open} className={`min-w-0 ${compact ? "px-0" : "px-0 sm:px-2"} pb-2`}>{children}</div>
  </div>;
}

function TeamBranch({ node, project, depth, collapsed, toggle }: { node: OrganizationNode; project: ChartProject; depth: number; collapsed: Set<string>; toggle: (key: string) => void }) {
  const t = useTranslations("squads.chart");
  const key = `team:${node.team.id}`;
  return <li data-org-team={node.team.id} className={`min-w-0 ${depth < 2 ? "rounded-lg border bg-surface-2/50 p-1 sm:p-2" : "border-t pt-2"}`}>
    <Disclosure compact={depth >= 2} label={node.team.name} count={node.members.length} open={!collapsed.has(key)} onToggle={() => toggle(key)}>
      <Link href={`/projects/${project.slug}/teams/${node.team.id}`} aria-label={t("openTeam", { name: node.team.name })} className="mb-3 inline-flex min-h-8 items-center text-xs text-muted-foreground underline underline-offset-2">{t("teamDetails")}</Link>
      <People people={node.members} project={project} />
      {node.children.length > 0 && <div className="mt-3 min-w-0">
        <p className="mb-2 text-xs font-medium text-muted-foreground sm:sr-only">{t("subteams")}</p>
        <ul className={`space-y-3 ${depth < 2 ? "sm:border-l sm:border-border-strong sm:pl-4" : ""}`} aria-label={t("subteams")}>
          {node.children.map(child => <TeamBranch key={child.team.id} node={child} project={project} depth={depth + 1} collapsed={collapsed} toggle={toggle} />)}
        </ul>
      </div>}
    </Disclosure>
  </li>;
}

/** Role groups and actual team relationships; disclosure state survives data refresh. */
export function TeamChart({ project, teams, teamsReady = true }: { project: ChartProject; teams: Team[]; teamsReady?: boolean }) {
  const t = useTranslations("squads.chart");
  const te = useTranslations("errors");
  const tw = useTranslations("workspace");
  const actorId = useSession().data?.id;
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const organization = useQuery({
    queryKey: [...teamsKey(project.id), "organization", actorId, teams.map(team => team.id).sort()],
    queryFn: ({ signal }) => loadOrganization(project.id, teams, signal),
    enabled: teamsReady && !!actorId,
  });
  const toggle = (key: string) => setCollapsed(previous => { const next = new Set(previous); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  const data = organization.data ? buildOrganization(project.id, teams, organization.data.members, organization.data.rosters) : null;
  return <section data-testid="organization-chart" className="workspace-panel min-w-0 p-4 sm:p-6" aria-label={t("label")}>
    <div className="flex min-w-0 items-center gap-3 border-b pb-4">
      <span data-logo-frame aria-hidden="true" className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-md border bg-muted"><ProjectMark shape={project.logoShape} key={projectLogoSrc(project) ?? "none"} name={project.name} src={projectLogoSrc(project)} /></span>
      <div className="min-w-0"><h2 className="font-semibold [overflow-wrap:anywhere]">{project.name}</h2>{data && !hasBlockingError(organization) && <p data-testid="organization-count" className="mt-1 text-xs text-muted-foreground">{t("totals", { members: data.people.length, teams: data.teamTotal })}</p>}</div>
    </div>
    <p className="my-4 text-xs leading-5 text-muted-foreground">{t("description")}</p>
    {hasBlockingError(organization) ? <div className="space-y-3"><p role="alert" className="text-sm text-destructive">{te(errorKey(organization.error))}</p><Button variant="outline" size="sm" onClick={() => void organization.refetch()}>{tw("retry")}</Button></div>
      : !data || !teamsReady ? <Skeleton className="h-48 w-full" /> : <ul className="space-y-4">
        <li className="min-w-0"><Disclosure label={t("managers")} count={data.managers.length} open={!collapsed.has("managers")} onToggle={() => toggle("managers")} testId="managers"><People people={data.managers} project={project} /></Disclosure></li>
        <li className="min-w-0"><Disclosure label={t("teams")} count={data.teamTotal} open={!collapsed.has("teams")} onToggle={() => toggle("teams")} testId="teams">
          {data.roots.length ? <ul className="space-y-3">{data.roots.map(node => <TeamBranch key={node.team.id} node={node} project={project} depth={0} collapsed={collapsed} toggle={toggle} />)}</ul> : <p className="py-3 text-sm text-muted-foreground">{t("emptyTeams")}</p>}
        </Disclosure></li>
        <li className="min-w-0"><Disclosure label={t("unassigned")} count={data.unassigned.length} open={!collapsed.has("unassigned")} onToggle={() => toggle("unassigned")} testId="unassigned"><People people={data.unassigned} project={project} /></Disclosure></li>
      </ul>}
  </section>;
}

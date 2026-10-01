"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { AvatarStack } from "@/components/common/avatar-stack";
import { ProjectMark } from "@/features/projects/components/project-card";
import type { Project } from "@/features/projects/types";
import { projectLogoSrc } from "../hooks";
import type { Team } from "../types";

type ChartProject = Pick<Project, "id" | "slug" | "name" | "logoVersion">;

type TeamNode = { team: Team; children: TeamNode[] };

/** Teams whose parent is missing from the set (for example archived) are shown at the top level. */
function buildTree(teams: Team[]): TeamNode[] {
  const nodes = new Map(teams.map((team) => [team.id, { team, children: [] as TeamNode[] }]));
  const roots: TeamNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.team.parentTeamId ? nodes.get(node.team.parentTeamId) : undefined;
    (parent ? parent.children : roots).push(node);
  }
  return roots;
}

function TeamBranch({ node, project }: { node: TeamNode; project: ChartProject }) {
  const t = useTranslations("squads.chart");
  const { team } = node;
  return (
    <li>
      <Link
        href={`/projects/${project.slug}/teams/${team.id}`}
        aria-label={t("openTeam", { name: team.name })}
        className="block w-full min-w-44 max-w-60 rounded-lg border bg-card px-3 py-2.5 transition-colors hover:border-border-strong hover:bg-muted/40 md:w-56"
      >
        <span className="block truncate text-sm font-medium text-foreground" title={team.name}>
          {team.name}
        </span>
        <span className="mt-2 flex items-center justify-between gap-2">
          {team.memberCount > 0 ? <AvatarStack people={team.memberPreview.slice(0, 3)} total={Math.min(team.memberCount, 3)} /> : <span />}
          <span className="text-xs text-muted-foreground">{t("members", { count: team.memberCount })}</span>
        </span>
      </Link>
      {node.children.length > 0 && (
        <ul>
          {node.children.map((child) => (
            <TeamBranch key={child.team.id} node={child} project={project} />
          ))}
        </ul>
      )}
    </li>
  );
}

/** Organisation chart of a project's teams: the project on top, teams nested by parent. Every team is a real link. */
export function TeamChart({ project, teams, memberTotal }: { project: ChartProject; teams: Team[]; memberTotal: number | null }) {
  const t = useTranslations("squads.chart");
  const roots = buildTree(teams);

  return (
    <div className="workspace-panel overflow-x-auto p-4 sm:p-6" role="group" aria-label={t("label")}>
      <div className="flex min-w-max flex-col items-start md:min-w-0 md:items-center">
        <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
          <span
            aria-hidden="true"
            className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-md border border-primary/25 bg-primary/10 font-heading text-sm font-semibold text-primary"
          >
            <ProjectMark key={projectLogoSrc(project) ?? "none"} name={project.name} src={projectLogoSrc(project)} />
          </span>
          <div className="min-w-0">
            <p className="max-w-56 truncate text-sm font-semibold text-foreground">{project.name}</p>
            {memberTotal != null && <p className="text-xs text-muted-foreground">{t("members", { count: memberTotal })}</p>}
          </div>
        </div>
        <ul className="org-tree">
          {roots.map((node) => (
            <TeamBranch key={node.team.id} node={node} project={project} />
          ))}
        </ul>
      </div>
    </div>
  );
}

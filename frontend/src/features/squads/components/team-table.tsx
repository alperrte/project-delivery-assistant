"use client";

import Link from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { PencilSimple } from "@phosphor-icons/react";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Project } from "@/features/projects/types";
import { cn } from "@/lib/utils";
import type { Team } from "../types";
import { DeleteTeamButton } from "./delete-team-button";
import { TeamMemberPreview } from "./team-member-preview";

type TeamTableProject = Pick<Project, "id" | "slug">;

type TeamTableProps = {
  /** The current page slice, the same one the card grid shows. */
  teams: Team[];
  project: TeamTableProject;
  /** Every team of the project by id, so a parent outside the current page still resolves to its name. */
  parentNames: Map<string, string>;
  canManage: boolean;
};

/** Edit link + delete button: the same two manager actions the card footer offers. */
function RowActions({ team, project, name }: { team: Team; project: TeamTableProject; name: string }) {
  const t = useTranslations("squads.card");
  return (
    <div className="flex items-center gap-1">
      <Link
        href={`/projects/${project.slug}/teams/${team.id}/edit`}
        className={cn(buttonVariants({ variant: "outline", size: "icon" }), "min-h-11 min-w-11")}
        aria-label={t("editNamed", { name })}
        title={t("edit")}
      >
        <PencilSimple size={16} aria-hidden="true" />
      </Link>
      <DeleteTeamButton projectId={project.id} teamId={team.id} teamName={name} />
    </div>
  );
}

function MemberCell({ team, compact }: { team: Team; compact: boolean }) {
  const t = useTranslations("squads.table");
  if (team.memberCount === 0) return <span className="text-sm text-muted-foreground">{t("noMembers")}</span>;
  return <TeamMemberPreview people={team.memberPreview} total={team.memberCount} compact={compact} />;
}

function ParentName({ name }: { name: string | null | undefined }) {
  const t = useTranslations("squads.table");
  if (!name) {
    return (
      <span className="text-muted-foreground">
        <span aria-hidden="true">—</span>
        <span className="sr-only">{t("noParent")}</span>
      </span>
    );
  }
  return <span className="block max-w-40 truncate text-foreground" title={name}>{name}</span>;
}

/**
 * Teams as a data table: a semantic table from `md` up (the parent column only from `xl`, below that the parent sits
 * under the name) and stacked `divide-y` rows below `md`, so phones never scroll sideways.
 */
export function TeamTable({ teams, project, parentNames, canManage }: TeamTableProps) {
  const t = useTranslations("squads.table");
  const tc = useTranslations("squads.card");
  const locale = useLocale();
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const base = (team: Team) => `/projects/${project.slug}/teams/${team.id}`;
  const label = (team: Team) => team.name.trim() || tc("namePlaceholder");
  const parentOf = (team: Team) => (team.parentTeamId ? parentNames.get(team.parentTeamId) : null);

  return (
    <>
      <ul className="divide-y rounded-2xl border bg-card shadow-sm md:hidden" aria-label={t("label")} data-testid="teams-stacked-list">
        {teams.map((team) => {
          const name = label(team);
          const parent = parentOf(team);
          return (
            <li key={team.id} className="min-w-0 space-y-3 p-4" data-team-row={team.id}>
              <div className="min-w-0">
                <Link href={base(team)} className="block truncate font-medium text-foreground hover:underline" title={name}>
                  {name}
                </Link>
                <p className="line-clamp-2 text-sm text-muted-foreground">{team.description || tc("noDescription")}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{t("members")}</p>
                <div className="flex flex-wrap items-center gap-3">
                  <MemberCell team={team} compact={false} />
                  {team.memberCount > 0 && <span className="text-sm text-muted-foreground">{tc("memberCount", { count: team.memberCount })}</span>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="min-w-0 space-y-1">
                  <p className="text-xs text-muted-foreground">{t("parent")}</p>
                  <ParentName name={parent} />
                </div>
                <div className="min-w-0 space-y-1">
                  <p className="text-xs text-muted-foreground">{t("updated")}</p>
                  <p className="truncate text-foreground">
                    <time dateTime={team.updatedAt}>{date.format(new Date(team.updatedAt))}</time>
                  </p>
                  {team.updatedBy && <p className="truncate text-xs text-muted-foreground">{team.updatedBy.nickname}</p>}
                </div>
              </div>
              {canManage && <RowActions team={team} project={project} name={name} />}
            </li>
          );
        })}
      </ul>

      <div className="hidden md:block" data-testid="teams-table">
        <Table aria-label={t("label")}>
          <TableHeader>
            <TableRow>
              <TableHead className="px-3">{t("team")}</TableHead>
              <TableHead className="px-3">{t("members")}</TableHead>
              <TableHead className="px-3">{t("memberCount")}</TableHead>
              <TableHead className="hidden px-3 xl:table-cell">{t("parent")}</TableHead>
              <TableHead className="px-3">{t("updated")}</TableHead>
              {canManage && <TableHead className="w-0 px-3 whitespace-nowrap">{t("actions")}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {teams.map((team) => {
              const name = label(team);
              const parent = parentOf(team);
              return (
                <TableRow key={team.id} data-team-row={team.id}>
                  <TableCell className="min-w-44 max-w-xs px-3 whitespace-normal">
                    <Link href={base(team)} className="block truncate font-medium text-foreground hover:underline" title={name}>
                      {name}
                    </Link>
                    <span className="block truncate text-xs text-muted-foreground" title={team.description || undefined}>
                      {team.description || tc("noDescription")}
                    </span>
                    {parent && <span className="mt-0.5 block truncate text-xs text-muted-foreground xl:hidden">{tc("parent", { name: parent })}</span>}
                  </TableCell>
                  <TableCell className="px-3">
                    <MemberCell team={team} compact />
                  </TableCell>
                  <TableCell className="px-3 text-muted-foreground tabular-nums">{team.memberCount}</TableCell>
                  <TableCell className="hidden px-3 xl:table-cell">
                    <ParentName name={parent} />
                  </TableCell>
                  <TableCell className="px-3">
                    <time dateTime={team.updatedAt} className="block text-foreground">{date.format(new Date(team.updatedAt))}</time>
                    {team.updatedBy && <span className="block max-w-32 truncate text-xs text-muted-foreground">{team.updatedBy.nickname}</span>}
                  </TableCell>
                  {canManage && (
                    <TableCell className="px-3">
                      <RowActions team={team} project={project} name={name} />
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

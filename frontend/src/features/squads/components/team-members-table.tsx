"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { Lock, PencilSimple, UserMinus, UserCircleMinus } from "@phosphor-icons/react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Avatar } from "@/components/ui/avatar";
import { profilePhotoSrc } from "@/features/account/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EditRolesDialog } from "@/features/projects/components/members/edit-roles-dialog";
import { membersApi } from "@/features/projects/members-api";
import { errorKey } from "@/lib/api/error-message";
import { squadsApi } from "../api";
import { teamsKey } from "../hooks";
import type { Team, TeamMember } from "../types";

const MAX_TEAM_CHIPS = 2;

type TableProps = {
  members: TeamMember[];
  team: Team;
  project: { id: string; slug: string; createdBy: string };
  currentUserId: string | undefined;
  editMode: boolean;
  /** `fromProject` removals of the signed-in user leave the project altogether. */
  onRemoved: (userId: string, fromProject: boolean) => void;
};

const displayName = (member: TeamMember) => member.nickname ?? member.email ?? member.userId;

function Identity({ member, founder, you }: { member: TeamMember; founder: boolean; you: boolean }) {
  const t = useTranslations("squads.detail");
  const name = displayName(member);
  return (
    <span className="flex min-w-0 items-center gap-3">
      <Avatar name={name} src={profilePhotoSrc(member.userId, member.profilePhotoVersion)} className="size-9 bg-muted text-foreground ring-0" />
      <span className="min-w-0">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium text-foreground">{name}</span>
          {founder && <Badge variant="outline">{t("founder")}</Badge>}
          {you && <span className="text-xs text-muted-foreground">{t("you")}</span>}
        </span>
        {member.email && member.email !== name && <span className="block truncate text-xs text-muted-foreground">{member.email}</span>}
      </span>
    </span>
  );
}

function RoleBadges({ member }: { member: TeamMember }) {
  const tr = useTranslations("roles");
  return (
    <span className="flex flex-wrap gap-1">
      {member.roles.map((role) => (
        <Badge key={role} variant={role === "PROJECT_MANAGER" ? "default" : "secondary"}>
          {tr(role)}
        </Badge>
      ))}
    </span>
  );
}

function OtherTeams({ member, slug }: { member: TeamMember; slug: string }) {
  const t = useTranslations("squads.detail");
  if (member.otherTeams.length === 0) return <span className="text-sm text-muted-foreground">{t("noOtherTeams")}</span>;
  const shown = member.otherTeams.slice(0, MAX_TEAM_CHIPS);
  const hidden = member.otherTeams.slice(MAX_TEAM_CHIPS);
  return (
    <span className="flex flex-wrap gap-1">
      {shown.map((other) => (
        <Link key={other.id} href={`/projects/${slug}/teams/${other.id}`} className="max-w-36 truncate rounded-full border px-2 py-0.5 text-xs text-foreground hover:bg-muted">
          {other.name}
        </Link>
      ))}
      {hidden.length > 0 && (
        <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground" title={hidden.map((other) => other.name).join(", ")}>
          {t("moreTeams", { count: hidden.length })}
        </span>
      )}
    </span>
  );
}

/** A disabled action that still explains itself on hover and keyboard focus. */
function LockedAction({ reason, icon }: { reason: string; icon: "lock" | "minus" }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span tabIndex={0} role="img" aria-label={reason} className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground" />}>
        {icon === "lock" ? <Lock size={16} aria-hidden="true" /> : <UserMinus size={16} aria-hidden="true" />}
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  );
}

function RowActions({ member, team, project, onRemoved }: { member: TeamMember; team: Team; project: TableProps["project"]; onRemoved: TableProps["onRemoved"] }) {
  const t = useTranslations("squads.detail.actions");
  const tm = useTranslations("members");
  const te = useTranslations("errors");
  const queryClient = useQueryClient();
  const name = displayName(member);
  const isFounder = member.userId === project.createdBy;
  const lastTeam = member.otherTeams.length === 0;
  const teamNames = [team.name, ...member.otherTeams.map((other) => other.name)].join(", ");

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: teamsKey(project.id) }),
      queryClient.invalidateQueries({ queryKey: ["projects", project.id, "members"] }),
    ]);

  return (
    <div className="flex items-center gap-1">
      <EditRolesDialog
        projectId={project.id}
        member={member}
        trigger={
          <Button variant="outline" size="icon-sm" aria-label={t("editRoles", { name })} title={t("editRolesHint")}>
            <PencilSimple size={15} aria-hidden="true" />
          </Button>
        }
      />

      {lastTeam ? (
        <LockedAction icon="minus" reason={t("lastTeam")} />
      ) : (
        <ConfirmDialog
          trigger={
            <Button variant="outline" size="icon-sm" aria-label={t("removeFromTeam", { name })} title={t("removeFromTeamShort")}>
              <UserMinus size={15} aria-hidden="true" />
            </Button>
          }
          title={t("removeFromTeamTitle", { name })}
          description={t("removeFromTeamDescription", { team: team.name })}
          confirmLabel={t("removeFromTeamShort")}
          cancelLabel={tm("cancel")}
          destructive
          onConfirm={async () => {
            try {
              await squadsApi.removeMember(project.id, team.id, member.userId);
              await refresh();
              onRemoved(member.userId, false);
              toast.success(t("removedFromTeam"));
            } catch (err) {
              toast.error(te(errorKey(err)));
              throw err;
            }
          }}
        />
      )}

      {isFounder ? (
        <LockedAction icon="lock" reason={t("founderLocked")} />
      ) : (
        <ConfirmDialog
          trigger={
            <Button variant="outline" size="icon-sm" aria-label={t("removeFromProject", { name })} title={t("removeFromProjectShort")}>
              <UserCircleMinus size={15} aria-hidden="true" />
            </Button>
          }
          title={t("removeFromProjectTitle", { name })}
          description={t("removeFromProjectDescription", { name, teams: teamNames })}
          confirmLabel={t("removeFromProjectShort")}
          cancelLabel={tm("cancel")}
          destructive
          onConfirm={async () => {
            try {
              await membersApi.remove(project.id, member.userId);
              await refresh();
              onRemoved(member.userId, true);
              toast.success(t("removedFromProject"));
            } catch (err) {
              toast.error(te(errorKey(err)));
              throw err;
            }
          }}
        />
      )}
    </div>
  );
}

/** Roster of one team: a table from md up, stacked rows below. The actions column only exists in edit mode. */
export function TeamMembersTable({ members, team, project, currentUserId, editMode, onRemoved }: TableProps) {
  const t = useTranslations("squads.detail");
  const locale = useLocale();
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const actions = (member: TeamMember) => <RowActions member={member} team={team} project={project} onRemoved={onRemoved} />;

  return (
    <>
      <ul className="space-y-3 md:hidden" aria-label={t("listLabel")}>
        {members.map((member) => (
          <li key={member.userId} className="workspace-panel space-y-3 p-4">
            <Identity member={member} founder={member.userId === project.createdBy} you={member.userId === currentUserId} />
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{t("columns.roles")}</p>
              <RoleBadges member={member} />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{t("columns.otherTeams")}</p>
              <OtherTeams member={member} slug={project.slug} />
            </div>
            <p className="text-xs text-muted-foreground">
              {t("columns.joined")}: <time dateTime={member.addedAt}>{date.format(new Date(member.addedAt))}</time>
            </p>
            {editMode && actions(member)}
          </li>
        ))}
      </ul>

      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columns.member")}</TableHead>
              <TableHead>{t("columns.roles")}</TableHead>
              <TableHead>{t("columns.otherTeams")}</TableHead>
              <TableHead>{t("columns.joined")}</TableHead>
              {editMode && <TableHead className="w-0 whitespace-nowrap">{t("columns.actions")}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.userId}>
                <TableCell>
                  <Identity member={member} founder={member.userId === project.createdBy} you={member.userId === currentUserId} />
                </TableCell>
                <TableCell>
                  <RoleBadges member={member} />
                </TableCell>
                <TableCell>
                  <OtherTeams member={member} slug={project.slug} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  <time dateTime={member.addedAt}>{date.format(new Date(member.addedAt))}</time>
                </TableCell>
                {editMode && <TableCell>{actions(member)}</TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

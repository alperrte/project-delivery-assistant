"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, PencilSimple, UserMinus } from "@phosphor-icons/react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { PaginationBar } from "@/components/common/pagination-bar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSession } from "@/features/auth/hooks/use-session";
import { projectsApi } from "@/features/projects/api";
import { EditRolesDialog } from "@/features/projects/components/members/edit-roles-dialog";
import { useCurrentMember } from "@/features/projects/hooks/use-current-member";
import { membersApi } from "@/features/projects/members-api";
import { errorKey } from "@/lib/api/error-message";
import { cn } from "@/lib/utils";
import { squadsApi } from "../api";
import type { SquadMember } from "../types";
import { AddTeamMemberDialog } from "./add-team-member-dialog";

function MemberIdentity({ member, locale }: { member: SquadMember; locale: string }) {
  const name = member.nickname ?? member.email ?? member.userId;
  return (
    <span className="flex min-w-0 items-center gap-3">
      <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full border border-primary/25 bg-primary/15 text-sm font-semibold text-primary">
        {name.slice(0, 1).toLocaleUpperCase(locale)}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-medium text-foreground">{name}</span>
        {member.email && member.email !== name && <span className="block truncate text-xs text-muted-foreground">{member.email}</span>}
      </span>
    </span>
  );
}

function MemberActions({
  member,
  projectId,
  teamId,
  general,
  onRemoved,
}: {
  member: SquadMember;
  projectId: string;
  teamId: string;
  general: boolean;
  onRemoved: (fromProject: boolean, userId: string) => void;
}) {
  const t = useTranslations("squads.membersPage");
  const tm = useTranslations("members");
  const te = useTranslations("errors");
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["projects", projectId] });

  return (
    <div className="flex flex-wrap gap-1.5">
      <EditRolesDialog
        projectId={projectId}
        member={member}
        trigger={<Button variant="outline" size="sm"><PencilSimple size={15} aria-hidden="true" />{tm("editRolesTitle")}</Button>}
      />
      {!general && (
        <ConfirmDialog
          trigger={<Button variant="ghost" size="sm"><UserMinus size={15} aria-hidden="true" />{t("removeFromTeam")}</Button>}
          title={t("removeFromTeamTitle")}
          description={t("removeFromTeamDescription")}
          confirmLabel={t("removeFromTeam")}
          cancelLabel={tm("cancel")}
          destructive
          onConfirm={async () => {
            try {
              await squadsApi.removeMember(projectId, teamId, member.userId);
              await invalidate();
              onRemoved(false, member.userId);
              toast.success(t("removedFromTeam"));
            } catch (err) {
              toast.error(te(errorKey(err)));
              throw err;
            }
          }}
        />
      )}
      <ConfirmDialog
        trigger={<Button variant="ghost" size="sm"><UserMinus size={15} aria-hidden="true" />{t("removeFromProject")}</Button>}
        title={t("removeFromProjectTitle")}
        description={t("removeFromProjectDescription")}
        confirmLabel={t("removeFromProject")}
        cancelLabel={tm("cancel")}
        destructive
        onConfirm={async () => {
          try {
            await membersApi.remove(projectId, member.userId);
            await invalidate();
            onRemoved(true, member.userId);
            toast.success(t("removedFromProject"));
          } catch (err) {
            toast.error(te(errorKey(err)));
            throw err;
          }
        }}
      />
    </div>
  );
}

export function TeamMembersPage({ slug, teamId }: { slug: string; teamId: string }) {
  const t = useTranslations("squads.membersPage");
  const tr = useTranslations("roles");
  const te = useTranslations("errors");
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: user, isError: sessionError, error: sessionErrorDetail } = useSession();
  const [page, setPage] = useState(0);
  const project = useQuery({
    queryKey: ["projects", "by-slug", slug],
    queryFn: () => projectsApi.bySlug(slug),
  });
  const currentMember = useCurrentMember(project.data?.id ?? "");
  const projectId = project.data?.id ?? "";
  const team = useQuery({
    queryKey: ["projects", projectId, "squads", teamId],
    queryFn: () => squadsApi.detail(projectId, teamId),
    enabled: !!projectId && !!currentMember.data,
  });
  const members = useQuery({
    queryKey: ["projects", projectId, "squads", teamId, "members", page],
    queryFn: () => squadsApi.members(projectId, teamId, page),
    enabled: !!projectId && !!currentMember.data && !!team.data,
  });
  const backHref = `/projects/${slug}?section=teams`;
  const isManager = currentMember.isManager;

  function afterRemoval(fromProject: boolean, userId: string) {
    if (fromProject && userId === user?.id) {
      router.replace("/projects");
      return;
    }
    setPage(0);
    void queryClient.invalidateQueries({ queryKey: ["projects", "by-slug", slug] });
  }

  if (project.isPending || !sessionError && !user || !!project.data && currentMember.isPending ||
      !!currentMember.data && (team.isPending || !!team.data && members.isPending)) {
    return <div className="space-y-5"><Skeleton className="h-24 w-full rounded-2xl" /><Skeleton className="h-64 w-full rounded-2xl" /></div>;
  }

  const failure = project.error ?? sessionErrorDetail ?? currentMember.error ?? team.error ?? members.error;
  if (failure) {
    return (
      <div className="space-y-4">
        <Link href={backHref} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}><ArrowLeft size={16} aria-hidden="true" />{t("back")}</Link>
        <div className="workspace-panel space-y-3 p-6">
          <p role="alert" className="text-sm text-destructive">{te(errorKey(failure))}</p>
          <Button variant="outline" size="sm" onClick={() => {
            if (project.isError) void project.refetch();
            if (sessionError) void queryClient.invalidateQueries({ queryKey: ["session"] });
            if (currentMember.isError) void currentMember.refetch();
            if (team.isError) void team.refetch();
            if (members.isError) void members.refetch();
          }}>{t("retry")}</Button>
        </div>
      </div>
    );
  }
  if (!project.data || !team.data || !members.data) return null;

  const teamData = team.data;
  const memberPage = members.data;
  const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const actions = (member: SquadMember) => isManager && (
    <MemberActions member={member} projectId={projectId} teamId={teamId} general={teamData.general} onRemoved={afterRemoval} />
  );
  const roleBadges = (member: SquadMember) => (
    <div className="flex flex-wrap gap-1">
      {member.roles.map((role) => (
        <Badge key={role} variant={role === "PROJECT_MANAGER" ? "default" : "secondary"}>{tr(role)}</Badge>
      ))}
    </div>
  );

  return (
    <div className="min-w-0 space-y-6">
      <Link href={backHref} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
        <ArrowLeft size={16} aria-hidden="true" />{t("back")}
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{project.data.name} / {t("teams")}</p>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{teamData.name}</h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{teamData.description || t("description")}</p>
          <p className="text-sm font-medium text-foreground">{t("memberCount", { count: memberPage.totalElements })}</p>
        </div>
        {isManager && !teamData.general && memberPage.content.length > 0 && <AddTeamMemberDialog projectId={projectId} teamId={teamId} />}
      </header>

      {memberPage.content.length === 0 ? (
        <EmptyState
          title={t("emptyTitle")}
          description={teamData.general ? t("emptyGeneral") : t("emptyCustom")}
          action={isManager && !teamData.general ? <AddTeamMemberDialog projectId={projectId} teamId={teamId} /> : undefined}
        />
      ) : (
        <>
          <ul className="space-y-3 md:hidden">
            {memberPage.content.map((member) => (
              <li key={member.userId} className="workspace-panel space-y-4 p-4">
                <MemberIdentity member={member} locale={locale} />
                <div><p className="mb-1.5 text-xs text-muted-foreground">{t("roles")}</p>{roleBadges(member)}</div>
                <p className="text-xs text-muted-foreground">{t("joinedAt")}: {dateFormatter.format(new Date(member.addedAt))}</p>
                {actions(member)}
              </li>
            ))}
          </ul>
          <div className="hidden md:block">
            <Table>
              <TableHeader><TableRow>
                <TableHead>{t("member")}</TableHead>
                <TableHead>{t("roles")}</TableHead>
                <TableHead>{t("joinedAt")}</TableHead>
                {isManager && <TableHead>{t("actions")}</TableHead>}
              </TableRow></TableHeader>
              <TableBody>
                {memberPage.content.map((member) => (
                  <TableRow key={member.userId}>
                    <TableCell><MemberIdentity member={member} locale={locale} /></TableCell>
                    <TableCell>{roleBadges(member)}</TableCell>
                    <TableCell className="text-muted-foreground">{dateFormatter.format(new Date(member.addedAt))}</TableCell>
                    {isManager && <TableCell>{actions(member)}</TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <PaginationBar page={memberPage.page} totalPages={memberPage.totalPages} totalElements={memberPage.totalElements} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowClockwise, Plus, UsersThree, X } from "@phosphor-icons/react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { PaginationBar } from "@/components/common/pagination-bar";
import { Avatar } from "@/components/ui/avatar";
import { profilePhotoSrc } from "@/features/account/api";
import { ProjectRoleBadge } from "@/features/projects/role-presentation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddTeamMemberDialog } from "@/features/squads/components/add-team-member-dialog";
import { errorKey } from "@/lib/api/error-message";
import { invitationsApi } from "../api";
import { invitationKeys } from "../query-keys";
import { useSession } from "@/features/auth/hooks/use-session";
import type { Invitation, InvitationStatus } from "../types";
import { InvitationStatusBadge } from "./invitation-status-badge";

const PAGE_SIZE = 20;
export const INVITATION_TABS = ["PENDING", "ACCEPTED", "REJECTED", "CANCELLED", "EXPIRED"] as const satisfies readonly InvitationStatus[];
type Tab = (typeof INVITATION_TABS)[number];

const isTab = (value: string | null): value is Tab => INVITATION_TABS.some((tab) => tab === value);

/** `?page=` is one based in the URL; anything unusable falls back to the first page. */
function pageFromParam(value: string | null): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 1 ? parsed - 1 : 0;
}

const targetName = (invitation: Invitation) =>
  invitation.firstName ? `${invitation.firstName} ${invitation.lastName ?? ""}`.trim() : (invitation.nickname ?? invitation.email ?? "?");

function Target({ invitation }: { invitation: Invitation }) {
  const t = useTranslations("invitations");
  const name = targetName(invitation);
  return (
    <span className="flex min-w-0 items-center gap-3">
      <Avatar name={name} src={invitation.invitedUserId ? profilePhotoSrc(invitation.invitedUserId, invitation.profilePhotoVersion) : null} className="size-9 bg-muted text-foreground ring-0" />
      <span className="min-w-0">
        <span className="block truncate font-medium text-foreground">{invitation.firstName || invitation.nickname ? name : (invitation.email ?? t("registeredTarget"))}</span>
        {invitation.firstName && invitation.email && <span className="block truncate text-xs text-muted-foreground">{invitation.email}</span>}
      </span>
    </span>
  );
}

function Inviter({ invitation }: { invitation: Invitation }) {
  const t = useTranslations("invitations");
  const name = invitation.invitedByNickname ?? t("unknownInviter");
  return <span className="flex min-w-0 items-center gap-2" title={name}>
    <Avatar name={name} src={profilePhotoSrc(invitation.invitedBy, invitation.invitedByPhotoVersion)} className="size-6 shrink-0 bg-muted text-foreground" />
    <span className="min-w-0 truncate text-sm text-muted-foreground">{name}</span>
  </span>;
}

function StatusBadge({ invitation }: { invitation: Invitation }) {
  return (
    <div className="space-y-1">
      <InvitationStatusBadge status={invitation.status} />
      {invitation.rejectionMessage && <p className="max-w-56 text-xs text-muted-foreground">{invitation.rejectionMessage}</p>}
    </div>
  );
}

export function InvitationsPage({ projectId }: { projectId: string }) {
  const t = useTranslations("invitations");
  const te = useTranslations("errors");
  const tm = useTranslations("members");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const {data:user}=useSession();

  const requestedTab = searchParams.get("status");
  const tab: Tab = isTab(requestedTab) ? requestedTab : "PENDING";
  const page = pageFromParam(searchParams.get("page"));

  const invitations = useQuery({
    queryKey: [...invitationKeys.project(projectId,user?.id), tab, page],
    queryFn: ({signal}) => invitationsApi.list(projectId, page, PAGE_SIZE, tab,signal),
    enabled: !!user?.id,
  });

  useEffect(() => {
    const data = invitations.data;
    if (!data || invitations.isFetching || invitations.isError || page === 0 || page < Math.max(data.totalPages, 1)) return;
    const params = new URLSearchParams(searchParams.toString());
    if (data.totalPages > 1) params.set("page", String(data.totalPages));
    else params.delete("page");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [invitations.data, invitations.isFetching, invitations.isError, page, searchParams, pathname, router]);

  function go(changes: { status?: Tab; page?: number }) {
    const params = new URLSearchParams(searchParams.toString());
    if (changes.status) {
      if (changes.status === "PENDING") params.delete("status");
      else params.set("status", changes.status);
    }
    if (changes.page !== undefined) {
      if (changes.page > 0) params.set("page", String(changes.page + 1));
      else params.delete("page");
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["projects", projectId, "invitations"] });

  const resend = useMutation({
    mutationFn: (invitationId: string) => invitationsApi.resend(projectId, invitationId),
    onSuccess: () => {
      void refresh();
      toast.success(t("resent"));
    },
    onError: (err) => toast.error(te(errorKey(err))),
  });

  const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const rows = invitations.data?.content ?? [];

  const actions = (invitation: Invitation) =>
    (invitation.status === "PENDING" || invitation.status === "EXPIRED") && (
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="min-h-11"
          disabled={resend.isPending}
          aria-label={t("resendNamed", { name: targetName(invitation) })}
          onClick={() => resend.mutate(invitation.id)}
        >
          <ArrowClockwise size={15} aria-hidden="true" />
          {t("resend")}
        </Button>
        {invitation.status === "PENDING" && <ConfirmDialog
          trigger={
            <Button variant="ghost" size="sm" className="min-h-11" aria-label={t("cancelNamed", { name: targetName(invitation) })}>
              <X size={15} aria-hidden="true" />
              {t("cancel")}
            </Button>
          }
          title={t("cancelTitle", { name: targetName(invitation) })}
          description={t("cancelDescription")}
          confirmLabel={t("cancel")}
          cancelLabel={tm("cancel")}
          destructive
          onConfirm={async () => {
            try {
              await invitationsApi.cancel(projectId, invitation.id);
              await refresh();
              toast.success(t("cancelled"));
            } catch (err) {
              toast.error(te(errorKey(err)));
              throw err;
            }
          }}
        />}
      </div>
    );

  return (
    <div>
      <PageHeader
        title={t("pageTitle")}
        description={t("pageDescription")}
        action={
          <AddTeamMemberDialog
            projectId={projectId}
            trigger={
              <Button>
                <Plus data-icon="inline-start" size={16} aria-hidden="true" />
                {t("invite")}
              </Button>
            }
          />
        }
      />

      <Tabs value={tab} onValueChange={(next) => isTab(next as string) && go({ status: next as Tab, page: 0 })} className="mb-4">
        <TabsList aria-label={t("tabsLabel")} className="max-w-full overflow-x-auto">
          {INVITATION_TABS.map((value) => (
            <TabsTrigger key={value} value={value}>
              {t(`statusValues.${value}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {invitations.isLoading && (
        <div className="space-y-2" aria-hidden="true">
          {[0, 1, 2].map((key) => <Skeleton key={key} className="h-14 w-full rounded-lg" />)}
        </div>
      )}
      {invitations.isError && (
        <div className="workspace-panel space-y-3 p-6">
          <p role="alert" className="text-sm text-destructive">{te(errorKey(invitations.error))}</p>
          <Button variant="outline" size="sm" onClick={() => void invitations.refetch()}>{t("retry")}</Button>
        </div>
      )}
      {!invitations.isError && invitations.data && rows.length === 0 && (
        <EmptyState title={t(`empty.${tab}.title`)} description={t(`empty.${tab}.description`)} />
      )}

      {!invitations.isError && invitations.data && rows.length > 0 && (
        <>
          <ul className="space-y-3 md:hidden" aria-label={t("listLabel")}>
            {rows.map((invitation) => (
              <li key={invitation.id} className="workspace-panel space-y-3 p-4">
                <Target invitation={invitation} />
                <p className="flex min-w-0 items-center gap-2 text-sm">
                  <UsersThree size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 break-words"><span className="text-muted-foreground">{t("columns.team")}: </span>{invitation.teamName ?? t("noTeam")}</span>
                </p>
                <div className="flex flex-wrap gap-1">
                  {invitation.initialRoles.map((role) => <ProjectRoleBadge key={role} role={role} />)}
                </div>
                <p className="text-xs text-muted-foreground">{dateFormatter.format(new Date(invitation.createdAt))}</p>
                <div className="space-y-1"><p className="text-xs text-muted-foreground">{t("columns.invitedBy")}</p><Inviter invitation={invitation} /></div>
                <StatusBadge invitation={invitation} />
                {actions(invitation)}
              </li>
            ))}
          </ul>

          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("columns.target")}</TableHead>
                  <TableHead>{t("columns.team")}</TableHead>
                  <TableHead>{t("columns.roles")}</TableHead>
                  <TableHead>{t("columns.sentAt")}</TableHead>
                  <TableHead>{t("columns.invitedBy")}</TableHead>
                  <TableHead>{t("columns.status")}</TableHead>
                  <TableHead className="text-right">{t("columns.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell className="max-w-64"><Target invitation={invitation} /></TableCell>
                    <TableCell className="max-w-44 truncate">{invitation.teamName ?? <span className="text-muted-foreground">{t("noTeam")}</span>}</TableCell>
                    <TableCell className="min-w-44 max-w-72">
                      <div className="flex flex-wrap gap-1">
                        {invitation.initialRoles.map((role) => <ProjectRoleBadge key={role} role={role} />)}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{dateFormatter.format(new Date(invitation.createdAt))}</TableCell>
                    <TableCell className="max-w-44"><Inviter invitation={invitation} /></TableCell>
                    <TableCell><StatusBadge invitation={invitation} /></TableCell>
                    <TableCell className="text-right"><div className="flex justify-end">{actions(invitation)}</div></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <PaginationBar
            page={invitations.data.page}
            totalPages={invitations.data.totalPages}
            totalElements={invitations.data.totalElements}
            pageSize={PAGE_SIZE}
            onPageChange={(next) => go({ page: next })}
          />
        </>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, UsersThree } from "@phosphor-icons/react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { PaginationBar } from "@/components/common/pagination-bar";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { errorKey, inviteeErrorKey } from "@/lib/api/error-message";
import { profilePhotoSrc } from "@/features/account/api";
import { invitationsApi } from "@/features/invitations/api";
import { InvitationProjectPreviewDialog } from "@/features/invitations/components/invitation-project-preview-dialog";
import { InvitationStatusBadge } from "@/features/invitations/components/invitation-status-badge";
import type { MyInvitation } from "@/features/invitations/types";
import { invitationKeys } from "@/features/invitations/query-keys";
import { ProjectMark } from "@/features/projects/components/project-mark";
import { ProjectRoleBadge } from "@/features/projects/role-presentation";
import { useSession } from "@/features/auth/hooks/use-session";

import { useIncomingInvitationCount } from "@/features/invitations/hooks";
import { PendingInvitationBadge } from "@/features/invitations/components/pending-invitation-badge";

const PAGE_SIZE = 20;
const FILTERS = ["PENDING", "ALL"] as const;
type Filter = (typeof FILTERS)[number];

/** `?status=ALL` opens the history; anything else (or nothing) is the default pending list. */
const filterFromParam = (value: string | null): Filter => (value === "ALL" ? "ALL" : "PENDING");

/** `?page=` is one based in the URL; anything unusable falls back to the first page. */
function pageFromParam(value: string | null): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 1 ? parsed - 1 : 0;
}

/** The inviter's photo (or initials) next to their name. */
function Inviter({ invitation }: { invitation: MyInvitation }) {
  const t = useTranslations("invitations");
  const name = invitation.invitedByNickname ?? t("mineUnknownInviter");
  return (
    <span className="flex min-w-0 items-center gap-2" title={name}>
      <Avatar name={name} src={profilePhotoSrc(invitation.invitedBy, invitation.invitedByPhotoVersion)}
        className="size-6 shrink-0 bg-muted text-[10px] text-foreground ring-0" />
      <span className="min-w-0 truncate text-sm text-foreground">{name}</span>
    </span>
  );
}

function InvitationDate({ invitation, formatter }: { invitation: MyInvitation; formatter: Intl.DateTimeFormat }) {
  return <time dateTime={invitation.createdAt}>{formatter.format(new Date(invitation.createdAt))}</time>;
}

function RoleBadges({ invitation }: { invitation: MyInvitation }) {
  return (
    <div className="flex flex-wrap gap-1">
      {invitation.initialRoles.map((role) => <ProjectRoleBadge key={role} role={role} />)}
    </div>
  );
}

/** Logo tile (the first letter: the list carries no logo), project name, team and the optional invitation message. */
function ProjectCell({ invitation, wrapMessage = false }: { invitation: MyInvitation; wrapMessage?: boolean }) {
  const t = useTranslations("invitations");
  const name = invitation.projectName ?? t("mineUnavailableProject");
  const teamTitle = invitation.teamName ? t("mineTeamInvitation", { team: invitation.teamName }) : t("mineProjectInvitation");
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span aria-hidden="true"
        className="grid size-10 shrink-0 place-items-center rounded-lg border border-primary/25 bg-primary/10 font-heading text-sm font-semibold text-primary">
        <ProjectMark name={invitation.projectName ?? "?"} src={null} />
      </span>
      <div className="min-w-0 space-y-0.5">
        <p className={cn("truncate font-medium", invitation.projectName ? "text-foreground" : "text-muted-foreground")} title={name}>{name}</p>
        <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground" title={teamTitle}>
          <UsersThree size={14} className="shrink-0" aria-hidden="true" />
          <span className="min-w-0 truncate">{invitation.teamName ?? t("noTeam")}</span>
        </p>
        {invitation.message && (
          <p className={cn("text-xs text-muted-foreground", wrapMessage ? "line-clamp-2 break-words" : "truncate")} title={invitation.message}>{invitation.message}</p>
        )}
      </div>
    </div>
  );
}

export function MyInvitationsPage() {
  const {data:user}=useSession();
  return <RecipientInvitations key={user?.id ?? "signed-out"} userId={user?.id} />;
}

/** Local preview/rejection state has the same principal boundary as the server query data. */
function RecipientInvitations({userId}:{userId:string|undefined}) {
  const count = useIncomingInvitationCount();
  const t = useTranslations("invitations");
  const te = useTranslations("errors");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Filter and page live in the URL (`?status=ALL`, `?page=`), so a deep link or a reload keeps the same list.
  const filter = filterFromParam(searchParams.get("status"));
  const page = pageFromParam(searchParams.get("page"));
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [rejectInvitation, setRejectInvitation] = useState<MyInvitation | null>(null);
  const [reason, setReason] = useState("");
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: invitationKeys.mine(userId, filter, page),
    queryFn: ({ signal }) => invitationsApi.mine(page, PAGE_SIZE, filter === "PENDING" ? "PENDING" : undefined, signal),
    enabled: !!userId,
    // New invitations arrive while the app is open, so this list is always read fresh instead of from the 30 s cache.
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  function replaceQuery(params: URLSearchParams) {
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function go(changes: { status?: Filter; page?: number }) {
    const params = new URLSearchParams(searchParams.toString());
    if (changes.status) {
      if (changes.status === "PENDING") params.delete("status");
      else params.set("status", changes.status);
    }
    if (changes.page !== undefined) {
      if (changes.page > 0) params.set("page", String(changes.page + 1));
      else params.delete("page");
    }
    replaceQuery(params);
  }

  // Answering the last invitation of a page (or a shrinking list) must not leave the user on an empty page.
  useEffect(() => {
    if (!data || isError || page === 0 || page < Math.max(data.totalPages, 1)) return;
    const params = new URLSearchParams(searchParams.toString());
    if (data.totalPages > 1) params.set("page", String(data.totalPages));
    else params.delete("page");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [data, isError, page, searchParams, pathname, router]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: invitationKeys.mineRoot(userId) });
  const accept = useMutation({
    mutationFn: invitationsApi.acceptMine,
    onSuccess: async () => {
      await Promise.all([refresh(), queryClient.invalidateQueries({ queryKey: ["projects"] })]);
      toast.success(t("acceptSuccess"));
    },
    onError: (err) => toast.error(te(inviteeErrorKey(err))),
  });
  const reject = useMutation({
    mutationFn: ({ id, message }: { id: string; message: string }) => invitationsApi.rejectMine(id, message),
    onSuccess: async () => {
      await refresh();
      setRejectInvitation(null);
      setReason("");
      toast.success(t("rejectSuccess"));
    },
    onError: (err) => toast.error(te(errorKey(err))),
  });
  const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const busy = accept.isPending || reject.isPending;

  /**
   * Preview (secondary), reject (quiet destructive) and accept (primary) for an invitation that can still be
   * answered. In the table the preview is an icon button with a tooltip; on a card all three carry a label.
   * Rows outside the pending state show their status badge and no actions.
   */
  function actions(invitation: MyInvitation, layout: "table" | "card") {
    if (invitation.status !== "PENDING") return null;
    if (!invitation.projectName) return <p className="text-xs text-muted-foreground">{t("mineProjectGone")}</p>;
    const previewLabel = t("minePreviewNamed", { project: invitation.projectName });
    const openPreview = () => setPreviewId(invitation.id);
    const openReject = () => { setReason(""); setRejectInvitation(invitation); };
    const doAccept = () => accept.mutate(invitation.id);
    const rejectClass = "text-destructive hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/20";
    if (layout === "table") {
      return (
        <div className="flex items-center justify-end gap-2">
          <Tooltip>
            <TooltipTrigger render={
              <Button variant="outline" size="icon" className="size-11" aria-label={previewLabel} onClick={openPreview}>
                <Eye size={18} aria-hidden="true" />
              </Button>
            } />
            <TooltipContent>{t("minePreviewAction")}</TooltipContent>
          </Tooltip>
          <Button variant="ghost" className={cn("min-h-11 px-3", rejectClass)} disabled={busy} onClick={openReject}>{t("respond.reject")}</Button>
          <Button className="min-h-11 px-3" disabled={busy} onClick={doAccept}>{t("respond.accept")}</Button>
        </div>
      );
    }
    return (
      <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <Button variant="outline" className="col-span-2 min-h-11 w-full sm:w-auto" aria-label={previewLabel} onClick={openPreview}>
          <Eye size={16} aria-hidden="true" />
          {t("minePreviewAction")}
        </Button>
        <Button variant="outline" className={cn("min-h-11 w-full sm:w-auto", rejectClass)} disabled={busy} onClick={openReject}>{t("respond.reject")}</Button>
        <Button className="min-h-11 w-full sm:w-auto" disabled={busy} onClick={doAccept}>{t("respond.accept")}</Button>
      </div>
    );
  }

  const rows = data?.content ?? [];

  return (
    <section className="space-y-6">
      <PageHeader titleAdornment={<PendingInvitationBadge count={count.isSuccess ? count.data : undefined} />} title={t("mineTitle")} description={t("mineDescription")} />

      <Tabs value={filter} onValueChange={(next) => go({ status: next as Filter, page: 0 })}>
        <TabsList aria-label={t("mineTabsLabel")}>
          {FILTERS.map((value) => (
            <TabsTrigger key={value} value={value}>{t(value === "PENDING" ? "mineTabPending" : "mineTabAll")}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading && (
        <div aria-label={t("mineLoading")} role="status" className="space-y-2">
          {[0, 1, 2, 3].map((key) => <Skeleton key={key} className="h-16 w-full rounded-lg" />)}
        </div>
      )}
      {isError && (
        <div className="workspace-panel space-y-3 p-6">
          <p role="alert" className="text-sm text-destructive">{te(errorKey(error))}</p>
          <Button variant="outline" size="sm" className="min-h-11" onClick={() => void refetch()}>{t("retry")}</Button>
        </div>
      )}
      {!isError && data && rows.length === 0 && <EmptyState title={t(filter === "PENDING" ? "minePendingEmpty" : "mineEmpty")} />}

      {!isError && data && rows.length > 0 && (
        <>
          <ul className="space-y-3 xl:hidden" aria-label={t("mineListLabel")}>
            {rows.map((invitation) => {
              const cardActions = actions(invitation, "card");
              return (
                <li key={invitation.id} className="workspace-panel space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1"><ProjectCell invitation={invitation} wrapMessage /></div>
                    <InvitationStatusBadge status={invitation.status} />
                  </div>
                  <div className="space-y-3 md:flex md:items-start md:justify-between md:gap-6 md:space-y-0">
                    <RoleBadges invitation={invitation} />
                    <dl className="grid grid-cols-2 gap-3 text-sm md:flex md:shrink-0 md:gap-8">
                      <div className="min-w-0"><dt className="mb-1 text-xs text-muted-foreground">{t("mineInviter")}</dt>
                        <dd><Inviter invitation={invitation} /></dd></div>
                      <div className="min-w-0"><dt className="mb-1 text-xs text-muted-foreground">{t("mineDate")}</dt>
                        <dd className="text-foreground"><InvitationDate invitation={invitation} formatter={dateFormatter} /></dd></div>
                    </dl>
                  </div>
                  {cardActions && <div className="border-t pt-3">{cardActions}</div>}
                </li>
              );
            })}
          </ul>

          <div className="hidden xl:block">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="px-3">{t("mineProject")}</TableHead>
                <TableHead className="px-3">{t("columns.roles")}</TableHead>
                <TableHead className="px-3">{t("mineInviter")}</TableHead>
                <TableHead className="px-3">{t("mineDate")}</TableHead>
                <TableHead className="px-3">{t("columns.status")}</TableHead>
                <TableHead className="px-3 text-right">{t("columns.actions")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell className="min-w-44 max-w-56 whitespace-normal px-3"><ProjectCell invitation={invitation} /></TableCell>
                    <TableCell className="min-w-36 max-w-56 whitespace-normal px-3"><RoleBadges invitation={invitation} /></TableCell>
                    <TableCell className="max-w-36 px-3"><Inviter invitation={invitation} /></TableCell>
                    <TableCell className="px-3 text-muted-foreground"><InvitationDate invitation={invitation} formatter={dateFormatter} /></TableCell>
                    <TableCell className="px-3"><InvitationStatusBadge status={invitation.status} /></TableCell>
                    <TableCell className="px-3">{actions(invitation, "table")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <PaginationBar page={data.page} totalPages={data.totalPages} totalElements={data.totalElements}
            pageSize={PAGE_SIZE} onPageChange={(next) => go({ page: next })} />
        </>
      )}

      <InvitationProjectPreviewDialog invitationId={previewId} onClose={() => setPreviewId(null)} />

      <Dialog open={rejectInvitation !== null} onOpenChange={(open) => {
        if (!open && !reject.isPending) { setRejectInvitation(null); setReason(""); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("mineRejectTitle")}</DialogTitle>
            <DialogDescription>{t("mineRejectDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="invitation-rejection-reason" className="text-sm font-medium">{t("rejectionMessage")}</label>
            <Textarea id="invitation-rejection-reason" maxLength={500} value={reason}
              onChange={(event) => setReason(event.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={reject.isPending}
              onClick={() => { setRejectInvitation(null); setReason(""); }}>{t("cancel")}</Button>
            <Button variant="destructive" disabled={reject.isPending || !rejectInvitation}
              onClick={() => { if (rejectInvitation) reject.mutate({ id: rejectInvitation.id, message: reason }); }}>
              {t("respond.reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

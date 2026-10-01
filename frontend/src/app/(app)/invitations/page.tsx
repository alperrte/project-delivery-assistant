"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye } from "@phosphor-icons/react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { PaginationBar } from "@/components/common/pagination-bar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { errorKey } from "@/lib/api/error-message";
import { invitationsApi } from "@/features/invitations/api";
import { InvitationProjectPreviewDialog } from "@/features/invitations/components/invitation-project-preview-dialog";
import { InvitationStatusBadge } from "@/features/invitations/components/invitation-status-badge";
import type { MyInvitation } from "@/features/invitations/types";

const PAGE_SIZE = 20;

export default function MyInvitationsPage() {
  const t = useTranslations("invitations");
  const tr = useTranslations("roles");
  const te = useTranslations("errors");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [rejectInvitation, setRejectInvitation] = useState<MyInvitation | null>(null);
  const [reason, setReason] = useState("");
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["project-invitations", "me", page],
    queryFn: () => invitationsApi.mine(page, PAGE_SIZE),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["project-invitations", "me"] });
  const accept = useMutation({
    mutationFn: invitationsApi.acceptMine,
    onSuccess: async () => {
      await Promise.all([refresh(), queryClient.invalidateQueries({ queryKey: ["projects"] })]);
      toast.success(t("acceptSuccess"));
    },
    onError: (err) => toast.error(te(errorKey(err))),
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

  function invitationTitle(invitation: MyInvitation) {
    return invitation.teamName
      ? t("mineTeamInvitation", { team: invitation.teamName })
      : t("mineProjectInvitation");
  }

  function actions(invitation: MyInvitation) {
    const projectName = invitation.projectName ?? t("mineUnavailableProject");
    return (
      <div className="flex flex-wrap items-center gap-2 xl:justify-end">
        <Button variant="outline" size="sm" aria-label={t("minePreviewNamed", { project: projectName })}
          onClick={() => setPreviewId(invitation.id)}>
          <Eye size={15} aria-hidden="true" />
          {t("minePreviewAction")}
        </Button>
        {invitation.status === "PENDING" && (
          <>
            <Button size="sm" disabled={accept.isPending || reject.isPending}
              onClick={() => accept.mutate(invitation.id)}>{t("respond.accept")}</Button>
            <Button variant="ghost" size="sm" disabled={accept.isPending || reject.isPending}
              onClick={() => { setReason(""); setRejectInvitation(invitation); }}>{t("respond.reject")}</Button>
          </>
        )}
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <PageHeader title={t("mineTitle")} description={t("mineDescription")} />

      {isLoading && (
        <div aria-label={t("mineLoading")} role="status" className="space-y-2">
          {[0, 1, 2, 3].map((key) => <Skeleton key={key} className="h-16 w-full rounded-lg" />)}
        </div>
      )}
      {isError && (
        <div className="workspace-panel space-y-3 p-6">
          <p role="alert" className="text-sm text-destructive">{te(errorKey(error))}</p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>{t("retry")}</Button>
        </div>
      )}
      {data?.content.length === 0 && <EmptyState title={t("mineEmpty")} />}

      {data && data.content.length > 0 && (
        <>
          <ul className="space-y-3 xl:hidden" aria-label={t("mineListLabel")}>
            {data.content.map((invitation) => (
              <li key={invitation.id} className="workspace-panel space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold text-foreground" title={invitation.projectName ?? undefined}>
                      {invitation.projectName ?? t("mineUnavailableProject")}
                    </h2>
                    <p className="text-sm text-muted-foreground">{invitationTitle(invitation)}</p>
                  </div>
                  <InvitationStatusBadge status={invitation.status} />
                </div>
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <div><dt className="text-xs text-muted-foreground">{t("columns.team")}</dt>
                    <dd>{invitation.teamName ?? t("noTeam")}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">{t("mineInviter")}</dt>
                    <dd>{invitation.invitedByNickname ?? t("mineUnknownInviter")}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">{t("columns.sentAt")}</dt>
                    <dd>{dateFormatter.format(new Date(invitation.createdAt))}</dd></div>
                  <div className="min-w-0 sm:col-span-2"><dt className="text-xs text-muted-foreground">{t("mineMessage")}</dt>
                    <dd className="break-words" title={invitation.message ?? undefined}>{invitation.message || "—"}</dd></div>
                </dl>
                <div className="flex flex-wrap gap-1">
                  {invitation.initialRoles.map((role) => <Badge key={role} variant="secondary">{tr(role)}</Badge>)}
                </div>
                <div className="border-t pt-3">{actions(invitation)}</div>
              </li>
            ))}
          </ul>

          <div className="hidden xl:block">
            <Table>
              <TableHeader><TableRow>
                <TableHead>{t("mineProject")}</TableHead>
                <TableHead>{t("columns.team")}</TableHead>
                <TableHead>{t("mineInvitation")}</TableHead>
                <TableHead>{t("mineInviter")}</TableHead>
                <TableHead>{t("columns.status")}</TableHead>
                <TableHead className="text-right">{t("columns.actions")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {data.content.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell className="max-w-44 whitespace-normal font-medium text-foreground">
                      <span className="line-clamp-2" title={invitation.projectName ?? undefined}>
                        {invitation.projectName ?? t("mineUnavailableProject")}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-32 truncate" title={invitation.teamName ?? undefined}>
                      {invitation.teamName ?? t("noTeam")}
                    </TableCell>
                    <TableCell className="max-w-60 whitespace-normal">
                      <p className="font-medium text-foreground">{invitationTitle(invitation)}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground" title={invitation.message ?? undefined}>
                        {invitation.message || "—"}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {invitation.initialRoles.map((role) => <Badge key={role} variant="secondary">{tr(role)}</Badge>)}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <p>{invitation.invitedByNickname ?? t("mineUnknownInviter")}</p>
                      <p className="text-xs text-muted-foreground">{dateFormatter.format(new Date(invitation.createdAt))}</p>
                    </TableCell>
                    <TableCell><InvitationStatusBadge status={invitation.status} /></TableCell>
                    <TableCell>{actions(invitation)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <PaginationBar page={data.page} totalPages={data.totalPages} totalElements={data.totalElements}
            pageSize={PAGE_SIZE} onPageChange={setPage} />
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

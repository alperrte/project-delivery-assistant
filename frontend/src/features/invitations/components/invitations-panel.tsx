"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, ArrowClockwise, X } from "@phosphor-icons/react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { PaginationBar } from "@/components/common/pagination-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { errorKey } from "@/lib/api/error-message";
import { invitationsApi } from "../api";
import { InviteMemberDialog } from "./invite-member-dialog";

export function InvitationsPanel({ projectId }: { projectId: string }) {
  const t = useTranslations("invitations");
  const te = useTranslations("errors");
  const tr = useTranslations("roles");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["projects", projectId, "invitations", page],
    queryFn: () => invitationsApi.list(projectId, page),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["projects", projectId, "invitations"] });

  const resend = useMutation({
    mutationFn: (invitationId: string) => invitationsApi.resend(projectId, invitationId),
    onSuccess: () => {
      invalidate();
      toast.success(t("resent"));
    },
    onError: (err) => toast.error(te(errorKey(err))),
  });

  const cancel = useMutation({
    mutationFn: (invitationId: string) => invitationsApi.cancel(projectId, invitationId),
    onSuccess: () => {
      invalidate();
      toast.success(t("cancelled"));
    },
    onError: (err) => toast.error(te(errorKey(err))),
  });

  return (
    <div>
      <PageHeader
        title={t("pendingTitle")}
        description={t("description")}
        action={
          <InviteMemberDialog
            projectId={projectId}
            trigger={
              <Button>
                <Plus data-icon="inline-start" size={16} />
                {t("invite")}
              </Button>
            }
          />
        }
      />

      {isLoading && <Skeleton className="h-32 w-full" />}
      {isError && <p className="text-sm text-destructive">{te(errorKey(error))}</p>}
      {data && data.content.length === 0 && <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />}

      {data && data.content.length > 0 && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columns.target")}</TableHead>
                <TableHead>{t("columns.roles")}</TableHead>
                <TableHead>{t("columns.sentAt")}</TableHead>
                <TableHead>{t("columns.status")}</TableHead>
                <TableHead className="text-right">{t("columns.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.content.map((invitation) => (
                <TableRow key={invitation.id}>
                  <TableCell className="font-medium"><span className="flex items-center gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-full border border-primary/25 bg-primary/15 text-xs font-bold text-primary">{(invitation.firstName ?? invitation.nickname ?? invitation.email ?? "?").slice(0, 1).toLocaleUpperCase(locale)}</span><span>{invitation.firstName ? <><span className="block">{invitation.firstName} {invitation.lastName}</span><span className="block text-xs text-muted-foreground">{invitation.email}</span></> : invitation.nickname ?? invitation.email ?? t("registeredTarget")}</span></span></TableCell>
                  <TableCell><div className="flex flex-wrap gap-1">{invitation.initialRoles.map((role) => <Badge key={role} variant="secondary">{tr(role)}</Badge>)}</div></TableCell>
                  <TableCell className="text-muted-foreground">{new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(invitation.createdAt))}</TableCell>
                  <TableCell>
                    <Badge
                      className={
                        invitation.status === "ACCEPTED"
                          ? "border border-success/25 bg-success/10 text-success"
                          : invitation.status === "PENDING"
                            ? "border border-primary/25 bg-primary/10 text-primary"
                            : "border border-border bg-muted text-muted-foreground"
                      }
                    >
                      {t(`statusValues.${invitation.status}`)}
                    </Badge>
                    {invitation.rejectionMessage && <p className="mt-1 max-w-56 text-xs text-muted-foreground">{invitation.rejectionMessage}</p>}
                    {invitation.message && <p className="mt-1 max-w-56 text-xs text-muted-foreground">{invitation.message}</p>}
                  </TableCell>
                  <TableCell className="text-right">
                    {invitation.status === "PENDING" && (
                      <div className="flex justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label={t("resend")}
                          onClick={() => resend.mutate(invitation.id)}
                        >
                          <ArrowClockwise size={16} />
                          {t("resend")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={t("cancel")}
                          onClick={() => cancel.mutate(invitation.id)}
                        >
                          <X size={16} />
                          {t("cancel")}
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PaginationBar page={data.page} totalPages={data.totalPages} totalElements={data.totalElements} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}

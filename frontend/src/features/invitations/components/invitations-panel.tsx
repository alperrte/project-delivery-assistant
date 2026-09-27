"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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
      {data && data.content.length === 0 && <EmptyState title={t("emptyTitle")} />}

      {data && data.content.length > 0 && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columns.target")}</TableHead>
                <TableHead>{t("columns.status")}</TableHead>
                <TableHead className="text-right">{t("columns.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.content.map((invitation) => (
                <TableRow key={invitation.id}>
                  <TableCell className="font-medium">{invitation.email ?? invitation.invitedUserId}</TableCell>
                  <TableCell>
                    <Badge variant={invitation.status === "PENDING" ? "default" : "secondary"}>
                      {invitation.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {invitation.status === "PENDING" && (
                      <div className="flex justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("resend")}
                          onClick={() => resend.mutate(invitation.id)}
                        >
                          <ArrowClockwise size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("cancel")}
                          onClick={() => cancel.mutate(invitation.id)}
                        >
                          <X size={16} />
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

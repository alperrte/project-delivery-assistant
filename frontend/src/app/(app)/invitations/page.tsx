"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { PaginationBar } from "@/components/common/pagination-bar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { errorKey } from "@/lib/api/error-message";
import { invitationsApi } from "@/features/invitations/api";

export default function MyInvitationsPage() {
  const t = useTranslations("invitations");
  const tr = useTranslations("roles");
  const te = useTranslations("errors");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [rejectionMessages, setRejectionMessages] = useState<Record<string, string>>({});
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["project-invitations", "me", page],
    queryFn: () => invitationsApi.mine(page),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["project-invitations", "me"] });
  const accept = useMutation({
    mutationFn: invitationsApi.acceptMine,
    onSuccess: () => { refresh(); toast.success(t("acceptSuccess")); },
    onError: (err) => toast.error(te(errorKey(err))),
  });
  const reject = useMutation({
    mutationFn: (id: string) => invitationsApi.rejectMine(id, rejectionMessages[id] ?? ""),
    onSuccess: () => { refresh(); toast.success(t("rejectSuccess")); },
    onError: (err) => toast.error(te(errorKey(err))),
  });

  return (
    <section className="space-y-6">
      <PageHeader title={t("mineTitle")} description={t("mineDescription")} />
      {isLoading && <Skeleton className="h-32 w-full" />}
      {isError && <p className="text-sm text-destructive">{te(errorKey(error))}</p>}
      {data?.content.length === 0 && <EmptyState title={t("mineEmpty")} />}
      {data && data.content.length > 0 && (
        <>
          <ul className="space-y-3">
            {data.content.map((invitation) => (
              <li key={invitation.id} className="workspace-panel space-y-3 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-foreground">{invitation.projectName ?? invitation.projectId}</h2>
                    <p className="text-sm text-muted-foreground">{t("from", { name: invitation.invitedByNickname ?? invitation.invitedBy })}</p>
                    <p className="text-xs text-muted-foreground">{new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(invitation.createdAt))}</p>
                  </div>
                  <Badge variant="secondary">{t(`statusValues.${invitation.status}`)}</Badge>
                </div>
                <div className="flex flex-wrap gap-1">{invitation.initialRoles.map((role) => <Badge key={role} variant="secondary">{tr(role)}</Badge>)}</div>
                {invitation.message && <p className="text-sm text-muted-foreground">{invitation.message}</p>}
                {invitation.status === "PENDING" && (
                  <div className="space-y-2 border-t pt-3">
                    <Textarea
                      aria-label={t("rejectionMessage")}
                      placeholder={t("rejectionMessage")}
                      maxLength={500}
                      value={rejectionMessages[invitation.id] ?? ""}
                      onChange={(event) => setRejectionMessages((previous) => ({ ...previous, [invitation.id]: event.target.value }))}
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" disabled={accept.isPending || reject.isPending} onClick={() => reject.mutate(invitation.id)}>{t("respond.reject")}</Button>
                      <Button disabled={accept.isPending || reject.isPending} onClick={() => accept.mutate(invitation.id)}>{t("respond.accept")}</Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <PaginationBar page={data.page} totalPages={data.totalPages} totalElements={data.totalElements} onPageChange={setPage} />
        </>
      )}
    </section>
  );
}

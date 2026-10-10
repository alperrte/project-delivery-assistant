"use client";

import { useId } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { EnvelopeSimple } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Breadcrumb } from "@/components/common/breadcrumb";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/features/auth/hooks/use-session";
import Link from "@/i18n/navigation";
import { ApiError } from "@/lib/api/client";
import { errorKey } from "@/lib/api/error-message";
import { cn } from "@/lib/utils";
import { adminApi, SUPPORT_STATUSES, type SupportStatus } from "../api";
import { adminKeys } from "../query-keys";
import { ErrorPanel, Field, ToneBadge, useAdminDates } from "./admin-ui";
import { fullName, SUPPORT_STATUS_TONE } from "./support-page";

/** Not a validator: it only keeps a stray character from turning the reply link into something else. */
const SAFE_ADDRESS = /^[^\s@<>"',;:()\\?&#%]+@[^\s@<>"',;:()\\?&#%]+$/;

/**
 * One stored contact message. The text is what a visitor typed, so it is rendered as plain text with its line breaks
 * kept (never as HTML). Replying opens the administrator's own mail program; the status is the only thing that changes here.
 */
export function AdminSupportDetailPage({ requestId }: { requestId: string }) {
  const t = useTranslations("admin.support");
  const td = useTranslations("admin.support.detail");
  const ta = useTranslations("admin");
  const te = useTranslations("errors");
  const ids = useId();
  const queryClient = useQueryClient();
  const { data: me } = useSession();
  const actorId = me?.id;
  const dates = useAdminDates();

  const query = useQuery({
    queryKey: adminKeys.supportRequest(actorId, requestId),
    queryFn: ({ signal }) => adminApi.supportRequest(requestId, signal),
    enabled: !!actorId,
  });

  const change = useMutation({
    mutationFn: (status: SupportStatus) => adminApi.changeSupportStatus(requestId, status),
    onSuccess: async (updated, status) => {
      queryClient.setQueryData(adminKeys.supportRequest(actorId, requestId), updated);
      // The list, the "new" counter and the audit trail all changed with it.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.support(actorId), refetchType: "all" }),
        queryClient.invalidateQueries({ queryKey: adminKeys.audit(actorId) }),
      ]);
      toast.success(td("changed", { status: t(`statuses.${status}`) }));
    },
    onError: (error) => toast.error(te(errorKey(error))),
  });

  const crumbs = [{ label: ta("nav.support"), href: "/admin/support" }, { label: query.data ? fullName(query.data) : td("breadcrumbFallback") }];

  if (query.isError) {
    const gone = query.error instanceof ApiError && query.error.status === 404;
    return (
      <section aria-label={td("title")}>
        <Breadcrumb label={td("breadcrumb")} items={crumbs} className="mb-4" />
        {gone ? (
          <EmptyState
            title={td("notFound.title")}
            description={td("notFound.description")}
            action={<Link href="/admin/support" className={cn(buttonVariants({ variant: "outline" }), "min-h-11")}>{td("back")}</Link>}
          />
        ) : (
          <ErrorPanel message={td("error")} retryLabel={t("retry")} onRetry={() => void query.refetch()} />
        )}
      </section>
    );
  }

  if (!query.data) {
    return (
      <section aria-label={td("title")}>
        <Breadcrumb label={td("breadcrumb")} items={crumbs} className="mb-4" />
        <div role="status" aria-label={td("loading")} className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </section>
    );
  }

  const request = query.data;
  const others = SUPPORT_STATUSES.filter((status) => status !== request.status);
  const subject = encodeURIComponent(td("replySubject", { category: t(`categories.${request.category}`) }));
  const reply = SAFE_ADDRESS.test(request.email) ? `mailto:${request.email}?subject=${subject}` : null;

  return (
    <section aria-label={td("title")}>
      <Breadcrumb label={td("breadcrumb")} items={crumbs} className="mb-4" />
      <PageHeader
        title={fullName(request)}
        description={td("description")}
        titleAdornment={<ToneBadge tone={SUPPORT_STATUS_TONE[request.status]} data-status={request.status}>{t(`statuses.${request.status}`)}</ToneBadge>}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start">
        <section aria-labelledby={`${ids}-message`} className="rounded-2xl border bg-card p-5">
          <h2 id={`${ids}-message`} className="mb-3 text-lg font-semibold">{td("message")}</h2>
          <p className="text-sm leading-6 break-words whitespace-pre-wrap" data-testid="support-message">{request.message}</p>
        </section>

        <div className="space-y-4">
          <section aria-labelledby={`${ids}-details`} className="rounded-2xl border bg-card p-5">
            <h2 id={`${ids}-details`} className="mb-4 text-lg font-semibold">{td("details")}</h2>
            <dl className="space-y-4" data-testid="support-details">
              <Field label={t("columns.email")}><span className="break-all">{request.email}</span></Field>
              <Field label={t("columns.category")}>{t(`categories.${request.category}`)}</Field>
              <Field label={td("received")}>{dates.dateTime(request.createdAt)}</Field>
              <Field label={t("columns.delivery")}>
                <ToneBadge tone={request.deliveryStatus === "FAILED" ? "danger" : "neutral"}>{t(`delivery.${request.deliveryStatus}`)}</ToneBadge>
              </Field>
              {request.statusChangedAt && request.statusChangedAt !== request.createdAt && <Field label={td("statusChanged")}>{dates.dateTime(request.statusChangedAt)}</Field>}
            </dl>
            {reply && (
              <a href={reply} className={cn(buttonVariants({ variant: "outline" }), "mt-5 min-h-11 w-full gap-2")} data-testid="support-reply">
                <EnvelopeSimple size={16} aria-hidden="true" />
                {td("reply")}
              </a>
            )}
          </section>

          <section aria-labelledby={`${ids}-status`} className="rounded-2xl border bg-card p-5">
            <h2 id={`${ids}-status`} className="mb-1 text-lg font-semibold">{td("statusTitle")}</h2>
            <p className="mb-4 text-sm leading-6 text-muted-foreground">{td("statusHelp")}</p>
            <div className="flex flex-wrap gap-2">
              {others.map((status) =>
                status === "CLOSED" ? (
                  <ConfirmDialog
                    key={status}
                    trigger={<Button variant="default" className="min-h-11" disabled={change.isPending}>{td("actions.CLOSED")}</Button>}
                    title={td("closeTitle")}
                    description={td("closeDescription")}
                    confirmLabel={td("closeConfirm")}
                    cancelLabel={td("cancel")}
                    onConfirm={() => change.mutateAsync(status).then(() => undefined)}
                    formatError={(error) => te(errorKey(error))}
                  />
                ) : (
                  <Button key={status} variant="outline" className="min-h-11" disabled={change.isPending} onClick={() => change.mutate(status)}>
                    {td(`actions.${status}`)}
                  </Button>
                ),
              )}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}

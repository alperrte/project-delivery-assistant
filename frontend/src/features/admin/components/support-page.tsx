"use client";

import { useId, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { PaginationBar } from "@/components/common/pagination-bar";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSession } from "@/features/auth/hooks/use-session";
import Link from "@/i18n/navigation";
import { adminApi, SUPPORT_CATEGORIES, SUPPORT_STATUSES, type SupportCategory, type SupportStatus, type SupportSummary } from "../api";
import { adminKeys } from "../query-keys";
import { ErrorPanel, FilterSelect, LoadingRows, ToneBadge, useAdminDates, type Tone } from "./admin-ui";

const PAGE_SIZE = 20;
export const SUPPORT_STATUS_TONE: Record<SupportStatus, Tone> = { NEW: "info", IN_PROGRESS: "warning", CLOSED: "neutral" };

export const fullName = (request: { firstName: string; lastName: string | null }) => [request.firstName, request.lastName].filter(Boolean).join(" ");

/** The inbox of the public contact form. Everything a visitor typed is plain text here. */
export function AdminSupportPage() {
  const t = useTranslations("admin.support");
  const ids = useId();
  const { data: me } = useSession();
  const actorId = me?.id;
  const dates = useAdminDates();

  const [page, setPage] = useState(0);
  const [status, setStatus] = useState<SupportStatus | "ALL">("ALL");
  const [category, setCategory] = useState<SupportCategory | "ALL">("ALL");

  const params = { page, size: PAGE_SIZE, status: status === "ALL" ? ("" as const) : status, category: category === "ALL" ? ("" as const) : category };
  const query = useQuery({
    queryKey: adminKeys.supportPage(actorId, params),
    queryFn: ({ signal }) => adminApi.supportRequests(params, signal),
    enabled: !!actorId,
    placeholderData: keepPreviousData,
  });

  const filtered = status !== "ALL" || category !== "ALL";
  const items = query.data?.items ?? [];
  const total = query.data?.totalElements ?? 0;

  const statusBadge = (request: SupportSummary) => (
    <ToneBadge tone={SUPPORT_STATUS_TONE[request.status]} data-status={request.status}>{t(`statuses.${request.status}`)}</ToneBadge>
  );
  const categoryBadge = (request: SupportSummary) => <ToneBadge tone="neutral">{t(`categories.${request.category}`)}</ToneBadge>;
  const delivery = (request: SupportSummary) => (
    <ToneBadge tone={request.deliveryStatus === "FAILED" ? "danger" : "neutral"}>{t(`delivery.${request.deliveryStatus}`)}</ToneBadge>
  );
  const openLink = (request: SupportSummary) => (
    <Link
      href={`/admin/support/${request.id}`}
      data-support-link
      className="inline-flex min-h-11 max-w-full items-center rounded-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="truncate">{fullName(request)}</span>
    </Link>
  );

  return (
    <section aria-label={t("title")}>
      <PageHeader title={t("title")} description={t("description")} />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,14rem)_minmax(0,14rem)_auto] lg:items-end">
        <FilterSelect<SupportStatus | "ALL">
          id={`${ids}-status`}
          label={t("filters.status")}
          value={status}
          onChange={(next) => { setStatus(next); setPage(0); }}
          options={[{ value: "ALL", label: t("filters.allStatuses") }, ...SUPPORT_STATUSES.map((value) => ({ value, label: t(`statuses.${value}`) }))]}
        />
        <FilterSelect<SupportCategory | "ALL">
          id={`${ids}-category`}
          label={t("filters.category")}
          value={category}
          onChange={(next) => { setCategory(next); setPage(0); }}
          options={[{ value: "ALL", label: t("filters.allCategories") }, ...SUPPORT_CATEGORIES.map((value) => ({ value, label: t(`categories.${value}`) }))]}
        />
        <Button variant="outline" className="min-h-11" disabled={!filtered} onClick={() => { setStatus("ALL"); setCategory("ALL"); setPage(0); }}>{t("filters.clear")}</Button>
      </div>

      {query.isError && !query.data ? (
        <ErrorPanel message={t("error")} retryLabel={t("retry")} onRetry={() => void query.refetch()} />
      ) : !query.data ? (
        <LoadingRows label={t("loading")} />
      ) : items.length === 0 ? (
        <EmptyState title={t(filtered ? "empty.filteredTitle" : "empty.title")} description={t(filtered ? "empty.filteredDescription" : "empty.description")} />
      ) : (
        <div className={query.isPlaceholderData ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={query.isPlaceholderData}>
          <div className="hidden md:block">
            <Table aria-label={t("tableLabel")}>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">{t("columns.date")}</TableHead>
                  <TableHead scope="col">{t("columns.category")}</TableHead>
                  <TableHead scope="col">{t("columns.name")}</TableHead>
                  <TableHead scope="col">{t("columns.email")}</TableHead>
                  <TableHead scope="col">{t("columns.message")}</TableHead>
                  <TableHead scope="col">{t("columns.status")}</TableHead>
                  <TableHead scope="col">{t("columns.delivery")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((request) => (
                  <TableRow key={request.id} data-support-row={request.id} data-support-status={request.status}>
                    <TableCell className="whitespace-nowrap">{dates.dateTime(request.createdAt)}</TableCell>
                    <TableCell>{categoryBadge(request)}</TableCell>
                    <TableCell className="max-w-40 font-medium" title={fullName(request)}>{openLink(request)}</TableCell>
                    <TableCell className="max-w-48 truncate" title={request.email}>{request.email}</TableCell>
                    <TableCell className="max-w-64 truncate text-muted-foreground" title={request.messagePreview}>{request.messagePreview}</TableCell>
                    <TableCell>{statusBadge(request)}</TableCell>
                    <TableCell>{delivery(request)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="divide-y divide-border rounded-2xl border bg-card md:hidden" aria-label={t("tableLabel")}>
            {items.map((request) => (
              <li key={request.id} data-support-row={request.id} data-support-status={request.status} className="space-y-2 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">{openLink(request)}</div>
                  {statusBadge(request)}
                </div>
                <p className="text-sm break-all text-muted-foreground">{request.email}</p>
                <p className="line-clamp-2 text-sm break-words">{request.messagePreview}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {categoryBadge(request)}
                  {delivery(request)}
                  <span>{dates.dateTime(request.createdAt)}</span>
                </div>
              </li>
            ))}
          </ul>

          <PaginationBar page={page} totalPages={Math.max(Math.ceil(total / PAGE_SIZE), 1)} totalElements={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </div>
      )}
    </section>
  );
}

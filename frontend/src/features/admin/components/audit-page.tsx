"use client";

import { useId, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { PaginationBar } from "@/components/common/pagination-bar";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSession } from "@/features/auth/hooks/use-session";
import Link from "@/i18n/navigation";
import { adminApi, AUDIT_ACTIONS, type AuditAction, type AuditEvent, type AuditOutcome } from "../api";
import { daysBetween, useBrowserZone } from "../lib/browser-time";
import { adminKeys } from "../query-keys";
import { ErrorPanel, FilterSelect, LoadingRows, ToneBadge, useAdminDates, type Tone } from "./admin-ui";

const PAGE_SIZE = 20;
const MAX_DAYS = 800;
const OUTCOME_TONE: Record<AuditOutcome, Tone> = { SUCCESS: "success", FAILURE: "danger", DENIED: "warning" };
const linkClass = "rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50";

/** The persistent trail of administrator actions. Ids, codes and times; the server adds the nicknames for display. */
export function AdminAuditPage() {
  const t = useTranslations("admin.audit");
  const ids = useId();
  const { data: me } = useSession();
  const actorId = me?.id;
  const dates = useAdminDates();
  const zone = useBrowserZone();

  const [page, setPage] = useState(0);
  const [action, setAction] = useState<AuditAction | "ALL">("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const invalid = !!from && !!to && (from > to || daysBetween(from, to) > MAX_DAYS);
  const params = { page, size: PAGE_SIZE, action: action === "ALL" ? ("" as const) : action, from, to, zone: zone ?? "" };
  const query = useQuery({
    queryKey: adminKeys.auditPage(actorId, params),
    queryFn: ({ signal }) => adminApi.auditEvents(params, signal),
    enabled: !!actorId && !!zone && !invalid,
    placeholderData: keepPreviousData,
  });

  // Any change of a filter starts again at the first page.
  const filter = <T,>(set: (value: T) => void) => (value: T) => {
    set(value);
    setPage(0);
  };
  const filtered = action !== "ALL" || !!from || !!to;
  function clear() {
    setAction("ALL");
    setFrom("");
    setTo("");
    setPage(0);
  }

  const items = query.data?.items ?? [];
  const total = query.data?.totalElements ?? 0;

  function person(id: string | null, nickname: string | null) {
    if (!id) return <span className="text-muted-foreground">{t("unknownAccount")}</span>;
    if (!nickname) return <span className="text-muted-foreground">{t("removedAccount")}</span>;
    return <Link href={`/admin/users/${id}`} className={linkClass}>{nickname}</Link>;
  }

  function target(event: AuditEvent) {
    if (event.targetType === "USER") return person(event.targetId, event.targetNickname);
    if (event.targetType === "SUPPORT_REQUEST" && event.targetId) {
      return <Link href={`/admin/support/${event.targetId}`} className={linkClass}>{t("supportRequest", { id: event.targetId.slice(0, 8) })}</Link>;
    }
    return <span className="text-muted-foreground">{t("targets.SYSTEM")}</span>;
  }

  const outcome = (event: AuditEvent) => <ToneBadge tone={OUTCOME_TONE[event.outcome]} data-outcome={event.outcome}>{t(`outcomes.${event.outcome}`)}</ToneBadge>;
  const time = (event: AuditEvent) => <time dateTime={event.occurredAt}>{dates.dateTime(event.occurredAt)}</time>;

  return (
    <section aria-label={t("title")}>
      <PageHeader title={t("title")} description={t("description")} />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,18rem)_minmax(0,12rem)_minmax(0,12rem)_auto] lg:items-end">
        <FilterSelect<AuditAction | "ALL">
          id={`${ids}-action`}
          label={t("filters.action")}
          value={action}
          onChange={filter(setAction)}
          options={[{ value: "ALL", label: t("filters.allActions") }, ...AUDIT_ACTIONS.map((value) => ({ value, label: t(`actions.${value}`) }))]}
        />
        <DatePicker id="admin-audit-from" label={t("filters.from")} value={from} onChange={filter(setFrom)} invalid={invalid} describedBy={invalid ? `${ids}-invalid` : undefined} />
        <DatePicker id="admin-audit-to" label={t("filters.to")} value={to} onChange={filter(setTo)} invalid={invalid} describedBy={invalid ? `${ids}-invalid` : undefined} />
        <Button variant="outline" className="min-h-11" disabled={!filtered} onClick={clear}>{t("filters.clear")}</Button>
      </div>
      {invalid && <p id={`${ids}-invalid`} role="alert" className="mb-4 text-sm text-destructive">{t("filters.invalid")}</p>}
      {zone && <p className="mb-4 text-xs text-muted-foreground">{t("filters.zone", { zone })}</p>}

      {invalid ? null : query.isError && !query.data ? (
        <ErrorPanel message={t("error")} retryLabel={t("retry")} onRetry={() => void query.refetch()} />
      ) : !query.data ? (
        <LoadingRows label={t("loading")} />
      ) : items.length === 0 ? (
        <EmptyState
          title={t(filtered ? "empty.filteredTitle" : "empty.title")}
          description={t(filtered ? "empty.filteredDescription" : "empty.description")}
          action={filtered ? <Button variant="outline" className="min-h-11" onClick={clear}>{t("filters.clear")}</Button> : undefined}
        />
      ) : (
        <div className={query.isPlaceholderData ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={query.isPlaceholderData}>
          <div className="hidden md:block">
            <Table aria-label={t("tableLabel")}>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">{t("columns.time")}</TableHead>
                  <TableHead scope="col">{t("columns.actor")}</TableHead>
                  <TableHead scope="col">{t("columns.action")}</TableHead>
                  <TableHead scope="col">{t("columns.target")}</TableHead>
                  <TableHead scope="col">{t("columns.outcome")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((event) => (
                  <TableRow key={event.id} data-audit-row={event.action} data-audit-outcome={event.outcome}>
                    <TableCell className="whitespace-nowrap">{time(event)}</TableCell>
                    <TableCell className="max-w-48 truncate">{person(event.actorUserId, event.actorNickname)}</TableCell>
                    <TableCell className="font-medium">{t(`actions.${event.action}`)}</TableCell>
                    <TableCell className="max-w-56 truncate">{target(event)}</TableCell>
                    <TableCell>{outcome(event)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="divide-y divide-border rounded-2xl border bg-card md:hidden" aria-label={t("tableLabel")}>
            {items.map((event) => (
              <li key={event.id} data-audit-row={event.action} data-audit-outcome={event.outcome} className="space-y-1.5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 font-medium break-words">{t(`actions.${event.action}`)}</p>
                  {outcome(event)}
                </div>
                <p className="text-sm text-muted-foreground">{time(event)}</p>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">{t("columns.actor")}</dt>
                  <dd className="min-w-0 break-words">{person(event.actorUserId, event.actorNickname)}</dd>
                  <dt className="text-muted-foreground">{t("columns.target")}</dt>
                  <dd className="min-w-0 break-words">{target(event)}</dd>
                </dl>
              </li>
            ))}
          </ul>

          <PaginationBar page={page} totalPages={Math.max(Math.ceil(total / PAGE_SIZE), 1)} totalElements={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </div>
      )}
    </section>
  );
}

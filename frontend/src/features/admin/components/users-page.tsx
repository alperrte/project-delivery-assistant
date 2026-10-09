"use client";

import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { PaginationBar } from "@/components/common/pagination-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { OptionGroup } from "@/features/settings/components/option-group";
import { useSession } from "@/features/auth/hooks/use-session";
import { errorKey } from "@/lib/api/error-message";
import { adminApi, type AccountStatus, type AdminUser } from "../api";
import { adminKeys } from "../query-keys";

const PAGE_SIZE = 20;
type StatusFilter = AccountStatus | "ALL";
const STATUS_OPTIONS: StatusFilter[] = ["ALL", "ACTIVE", "DISABLED", "PENDING_VERIFICATION"];

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/** Plain text only: names and addresses are rendered as text, never as markup. */
export function AdminUsersPage() {
  const t = useTranslations("admin.users");
  const te = useTranslations("errors");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { data: me } = useSession();
  const actorId = me?.id;

  const [page, setPage] = useState(0);
  const [searchText, setSearchText] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const search = useDebounced(searchText.trim(), 300);

  const params = { page, size: PAGE_SIZE, search, status: status === "ALL" ? ("" as const) : status };
  const query = useQuery({
    queryKey: adminKeys.usersPage(actorId, params),
    queryFn: ({ signal }) => adminApi.users(params, signal),
    enabled: !!actorId,
    placeholderData: keepPreviousData,
  });

  // Any change of the filter starts again at the first page.
  function changeSearch(value: string) {
    setSearchText(value);
    setPage(0);
  }
  function changeStatus(value: StatusFilter) {
    setStatus(value);
    setPage(0);
  }

  const change = useMutation({
    mutationFn: ({ user, action }: { user: AdminUser; action: "disable" | "enable" }) =>
      action === "disable" ? adminApi.disable(user.id) : adminApi.enable(user.id),
    onSuccess: async (_result, { user, action }) => {
      await queryClient.invalidateQueries({ queryKey: adminKeys.users(actorId) });
      toast.success(t(action === "disable" ? "terminate.done" : "reactivate.done", { name: user.nickname }));
    },
  });

  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const statusLabel = (value: AccountStatus) => t(`statuses.${value}`);
  const items = query.data?.items ?? [];
  const total = query.data?.totalElements ?? 0;
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  function actions(user: AdminUser) {
    if (user.id === actorId) return <span className="text-sm text-muted-foreground">{t("you")}</span>;
    if (user.accountStatus === "DISABLED") {
      return (
        <ConfirmDialog
          trigger={<Button variant="outline" size="sm" className="min-h-9">{t("reactivate.action")}</Button>}
          title={t("reactivate.title", { name: user.nickname })}
          description={t("reactivate.description")}
          confirmLabel={t("reactivate.confirm")}
          cancelLabel={t("reactivate.cancel")}
          onConfirm={() => change.mutateAsync({ user, action: "enable" })}
          formatError={(error) => te(errorKey(error))}
        />
      );
    }
    return (
      <ConfirmDialog
        destructive
        trigger={<Button variant="destructive" size="sm" className="min-h-9">{t("terminate.action")}</Button>}
        title={t("terminate.title", { name: user.nickname })}
        description={t("terminate.description")}
        confirmLabel={t("terminate.confirm")}
        cancelLabel={t("terminate.cancel")}
        requireText={{ value: user.nickname, label: t("terminate.confirmLabel", { name: user.nickname }) }}
        onConfirm={() => change.mutateAsync({ user, action: "disable" })}
        formatError={(error) => te(errorKey(error))}
      />
    );
  }

  const statusBadge = (user: AdminUser) => (
    <Badge variant={user.accountStatus === "DISABLED" ? "destructive" : user.accountStatus === "ACTIVE" ? "secondary" : "outline"}>
      {statusLabel(user.accountStatus)}
    </Badge>
  );

  return (
    <section aria-label={t("title")}>
      <PageHeader title={t("title")} description={t("description")} />

      <div className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="admin-user-search">{t("search")}</Label>
          <div className="relative">
            <MagnifyingGlass size={16} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="admin-user-search"
              type="search"
              value={searchText}
              maxLength={100}
              autoComplete="off"
              placeholder={t("searchPlaceholder")}
              className="h-11 pl-9"
              onChange={(event) => changeSearch(event.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="text-sm leading-none font-medium">{t("status")}</p>
          <OptionGroup<StatusFilter>
            name="admin-user-status"
            label={t("status")}
            value={status}
            onChange={changeStatus}
            options={STATUS_OPTIONS.map((value) => ({ value, label: value === "ALL" ? t("statusAll") : statusLabel(value) }))}
          />
        </div>
      </div>

      {query.isError && !query.data ? (
        <div role="alert" className="rounded-2xl border bg-card p-6">
          <p className="text-sm text-destructive">{t("error")}</p>
          <Button variant="outline" className="mt-3 min-h-11" onClick={() => void query.refetch()}>{t("retry")}</Button>
        </div>
      ) : query.isLoading || (!query.data && !query.isError) ? (
        <div role="status" aria-label={t("tableLabel")} className="space-y-2">
          {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-14 w-full" />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState title={t("empty.title")} description={t("empty.description")} />
      ) : (
        <div className={query.isPlaceholderData ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={query.isPlaceholderData}>
          <div className="hidden md:block">
            <Table aria-label={t("tableLabel")}>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">{t("columns.user")}</TableHead>
                  <TableHead scope="col">{t("columns.email")}</TableHead>
                  <TableHead scope="col">{t("columns.status")}</TableHead>
                  <TableHead scope="col">{t("columns.role")}</TableHead>
                  <TableHead scope="col">{t("columns.created")}</TableHead>
                  <TableHead scope="col"><span className="sr-only">{t("columns.actions")}</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((user) => (
                  <TableRow key={user.id} data-user-row={user.nickname}>
                    <TableCell className="max-w-48 truncate font-medium" title={user.nickname}>{user.nickname}</TableCell>
                    <TableCell className="max-w-64 truncate" title={user.email}>{user.email}</TableCell>
                    <TableCell>{statusBadge(user)}</TableCell>
                    <TableCell>{t(`roles.${user.globalRole}`)}</TableCell>
                    <TableCell>{date.format(new Date(user.createdAt))}</TableCell>
                    <TableCell className="text-right">{actions(user)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="divide-y divide-border rounded-2xl border bg-card md:hidden" aria-label={t("tableLabel")}>
            {items.map((user) => (
              <li key={user.id} data-user-row={user.nickname} className="space-y-2 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 truncate font-medium">{user.nickname}</p>
                  {statusBadge(user)}
                </div>
                <p className="text-sm break-all text-muted-foreground">{user.email}</p>
                <p className="text-xs text-muted-foreground">{t(`roles.${user.globalRole}`)} · {date.format(new Date(user.createdAt))}</p>
                <div>{actions(user)}</div>
              </li>
            ))}
          </ul>

          <PaginationBar page={page} totalPages={totalPages} totalElements={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </div>
      )}
    </section>
  );
}

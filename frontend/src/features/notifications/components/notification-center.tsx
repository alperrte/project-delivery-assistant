"use client";

import { useRef, useState } from "react";
import Link from "@/i18n/navigation";
import { Popover } from "@base-ui/react/popover";
import { Bell, Check, Checks, CaretLeft, CaretRight } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { errorKey } from "@/lib/api/error-message";
import { ApiError } from "@/lib/api/client";
import { notificationsApi } from "../api";
import { notificationKeys } from "../query-keys";
import { useNotificationOwner } from "../notification-owner";
import type { Notification } from "../types";
import { useTaskFormat } from "@/features/tasks/format";

export function NotificationCenter({ expectedUserId, disabled = false }: { expectedUserId?: string; disabled?: boolean } = {}) {
  const context = useNotificationOwner();
  const owner = disabled || (expectedUserId && context?.userId !== expectedUserId) ? null : context;
  const navigatingTask = useRef(false);
  const userId = owner?.userId;
  const t = useTranslations("notifications");
  const tw = useTranslations("workspace");
  const te = useTranslations("errors");
  const ts = useTranslations("tasks.common.status");
  const locale = useLocale();
  const format = useTaskFormat();
  const client = useQueryClient();
  const [demoOpen, setDemoOpen] = useState(false);
  const [page, setPage] = useState(0);
  const open = owner ? owner.open : demoOpen;
  const count = useQuery({
    queryKey: notificationKeys.count(userId), queryFn: ({ signal }) => notificationsApi.count(signal),
    enabled: !!userId, refetchInterval: 30_000, refetchIntervalInBackground: false,
  });
  const list = useQuery({
    queryKey: notificationKeys.list(userId, page), queryFn: ({ signal }) => notificationsApi.list(page, signal),
    enabled: !!userId && open,
    staleTime: 0,
    refetchInterval: 15_000, refetchIntervalInBackground: false,
  });
  const refresh = () => client.invalidateQueries({ queryKey: notificationKeys.actor(userId) });
  const read = useMutation({
    mutationFn: (id: string) => notificationsApi.read(id),
    onSuccess: () => { if (owner?.current()) void refresh(); },
    onError: error => { if (owner?.current()) toast.error(te(errorKey(error))); },
  });
  const readAll = useMutation({
    mutationFn: notificationsApi.readAll,
    onSuccess: () => { if (owner?.current()) void refresh(); },
    onError: error => { if (owner?.current()) toast.error(te(errorKey(error))); },
  });
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" });
  const message = (error: unknown) => error instanceof ApiError && error.status >= 500 ? t("unavailable") : te(errorKey(error));

  function title(n: Notification) {
    if (n.teamDeletion) return t("teamDeleted");
    if (n.statusChange?.newStatus === "IN_PROGRESS") return t("taskStarted");
    if (n.statusChange?.newStatus === "DONE") return t("taskCompleted");
    return t.has(`types.${n.type}`) ? t(`types.${n.type}`) : n.title;
  }
  function body(n: Notification) {
    if (n.teamDeletion) return t("teamDeletedBody", { project: n.teamDeletion.projectName, team: n.teamDeletion.teamName,
      actor: n.teamDeletion.actorNickname ?? t("projectManager") });
    if (n.statusChange && (n.statusChange.newStatus === "IN_PROGRESS" || n.statusChange.newStatus === "DONE")) {
      return t(n.statusChange.newStatus === "IN_PROGRESS" ? "started" : "completed", {
        actor: n.statusChange.actorNickname ?? t("someone"), key: n.statusChange.taskKey, title: n.statusChange.taskTitle,
      });
    }
    if (n.statusChange) return t("taskStatusBody", { actor: n.statusChange.actorNickname ?? t("someone"),
      task: `${n.statusChange.taskKey}: ${n.statusChange.taskTitle}`,
      previous: ts.has(n.statusChange.previousStatus) ? ts(n.statusChange.previousStatus) : n.statusChange.previousStatus,
      current: ts.has(n.statusChange.newStatus) ? ts(n.statusChange.newStatus) : n.statusChange.newStatus });
    return t.has(`bodies.${n.type}`) ? t(`bodies.${n.type}`) : n.message;
  }

  return (
    <Popover.Root modal={false} open={open} onOpenChange={next => { if (owner) owner.setOpen(next); else setDemoOpen(next); if (next) { setPage(0); navigatingTask.current = false; } }}>
      <Popover.Trigger aria-label={tw("notifications")} render={<Button variant="ghost" size="icon" className="relative max-sm:size-11" />}>
        <Bell size={18} aria-hidden="true" />
        {count.isSuccess && count.data.count > 0 && <span className="absolute -right-0.5 -top-0.5 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground" aria-label={t("unreadCount", { count: count.data.count })}>{count.data.count > 99 ? "99+" : count.data.count}</span>}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner align="end" sideOffset={8} className="z-50 outline-none">
          <Popover.Popup className="w-[min(26rem,calc(100vw-2rem))] max-h-[min(70dvh,32rem)] overflow-y-auto rounded-xl border bg-popover p-4 text-popover-foreground shadow-lg outline-none"
            finalFocus={() => !navigatingTask.current}
            aria-label={t("title")} onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); if (owner) owner.setOpen(false); else setDemoOpen(false); } }}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold">{t("title")}</h2>
              {!!userId && <Button variant="ghost" size="sm" className="min-h-11" disabled={readAll.isPending || !count.data?.count} onClick={() => readAll.mutate()}><Checks size={16} aria-hidden="true" />{t("readAll")}</Button>}
            </div>
            {list.isLoading && <div role="status" aria-label={t("loading")} className="space-y-2"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>}
            {count.isError && <p role="status" className="mb-2 text-xs text-muted-foreground">{t("countUnavailable")}</p>}
            {list.isError && <div className="space-y-2"><p role="alert" className="text-sm text-destructive">{message(list.error)}</p><Button variant="outline" className="min-h-11" onClick={() => void list.refetch()}>{t("retry")}</Button></div>}
            {!userId && <p className="text-sm text-muted-foreground">{tw("noNotifications")}</p>}
            {list.data && !list.isError && list.data.content.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}
            {list.data && !list.isError && <ul className="space-y-2" aria-label={t("listLabel")}>
              {list.data.content.map(n => <li key={n.id} data-notification-id={n.id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0"><h3 className="break-words text-sm font-medium">{title(n)}</h3><p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">{body(n)}</p>
                    <p className="mt-2 text-xs text-muted-foreground"><time dateTime={n.createdAt} title={Number.isFinite(Date.parse(n.createdAt)) ? date.format(new Date(n.createdAt)) : undefined}>{Number.isFinite(Date.parse(n.createdAt)) ? format.relative(n.createdAt) : ""}</time> · {n.read ? t("read") : t("unread")}</p>
                    {n.resourceType === "TASK" && n.projectId && !!userId && <Link
                      href={`/tasks?task=${encodeURIComponent(n.resourceId)}&taskProject=${encodeURIComponent(n.projectId)}`}
                      className="mt-2 inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4"
                      onClick={event => {
                        if (!owner?.current()) { event.preventDefault(); return; }
                        navigatingTask.current = true;
                        if (!n.read) read.mutate(n.id);
                        owner.setOpen(false);
                      }}>{t("openTask")}</Link>}
                  </div>
                  {!n.read && <Button variant="ghost" size="icon" className="min-h-11 min-w-11 shrink-0" aria-label={t("markRead")} disabled={read.isPending} onClick={() => read.mutate(n.id)}><Check size={16} aria-hidden="true" /></Button>}
                </div>
              </li>)}
            </ul>}
            {list.data && list.data.totalPages > 1 && <div className="mt-3 flex items-center justify-between gap-2">
              <Button variant="outline" size="icon" className="min-h-11 min-w-11" aria-label={t("previous")} disabled={page === 0} onClick={() => setPage(page - 1)}><CaretLeft size={16} aria-hidden="true" /></Button>
              <span className="text-xs text-muted-foreground">{t("page", { page: list.data.page + 1, total: list.data.totalPages })}</span>
              <Button variant="outline" size="icon" className="min-h-11 min-w-11" aria-label={t("next")} disabled={page + 1 >= list.data.totalPages} onClick={() => setPage(page + 1)}><CaretRight size={16} aria-hidden="true" /></Button>
            </div>}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Bell, Check, CaretLeft, CaretRight } from "@phosphor-icons/react";
import { toast } from "sonner";
import Link from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { errorKey } from "@/lib/api/error-message";
import { cn } from "@/lib/utils";
import { useTaskFormat } from "@/features/tasks/format";
import { TASK_STATUSES } from "@/features/tasks/types";
import { notificationsApi, type Notification } from "./api";

function NotificationText({ notification: n }: { notification: Notification }) {
  const t = useTranslations("notifications");
  const tc = useTranslations("tasks.common.status");
  const format = useTaskFormat();
  const change = n.statusChange;
  const title = t.has(`types.${n.type}`) ? t(`types.${n.type}`) : t("update");
  const message = change && TASK_STATUSES.includes(change.newStatus) ? t(change.newStatus === "IN_PROGRESS" ? "started" : change.newStatus === "DONE" ? "completed" : "statusChanged", {
    actor: change.actorNickname || t("someone"), key: change.taskKey, title: change.taskTitle, status: tc(change.newStatus),
  }) : null;
  return <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
    <span className={cn("text-sm", !n.read && "font-semibold")}>{title}</span>
    {message && <span className="text-xs leading-5 break-words text-muted-foreground">{message}</span>}
    <time dateTime={n.createdAt} title={format.dateTime(n.createdAt)} className="text-[11px] text-muted-foreground">{format.relative(n.createdAt)}</time>
  </span>;
}

export function NotificationsMenu({ userId, disabled = false }: { userId?: string; disabled?: boolean }) {
  const t = useTranslations("notifications");
  const tw = useTranslations("workspace");
  const te = useTranslations("errors");
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const client = useQueryClient();
  const enabled = !!userId && !disabled;
  const key = ["notifications", userId] as const;
  const count = useQuery({ queryKey: [...key, "count"], queryFn: notificationsApi.count, enabled, refetchInterval: 15_000 });
  const list = useQuery({ queryKey: [...key, "list", page], queryFn: () => notificationsApi.list(page), enabled: enabled && open, refetchInterval: 15_000 });
  const read = useMutation({
    mutationFn: async (id: string | null) => { if (id) await notificationsApi.read(id); else await notificationsApi.readAll(); },
    onSuccess: () => { void client.invalidateQueries({ queryKey: key }); },
    onError: (error) => toast.error(te(errorKey(error))),
  });
  const unread = count.data?.count ?? 0;
  return <DropdownMenu open={open} onOpenChange={(next) => { setOpen(next); if (next) setPage(0); }}>
    <DropdownMenuTrigger aria-label={unread ? t("label", { count: unread }) : tw("notifications")} render={<Button variant="ghost" size="icon" className="relative"><Bell size={18} aria-hidden="true" />{unread > 0 && <span aria-hidden="true" className="absolute -top-1 -right-1 min-w-4 rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">{unread > 99 ? "99+" : unread}</span>}</Button>} />
    <DropdownMenuContent align="end" className="w-[min(24rem,calc(100vw-1.5rem))] max-h-[calc(100dvh-10rem)] overflow-y-auto">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-2 pb-2"><p className="text-sm font-semibold">{tw("notifications")}</p>{enabled && unread > 0 && <Button variant="ghost" size="sm" disabled={read.isPending} onClick={() => read.mutate(null)}><Check aria-hidden="true" />{t("readAll")}</Button>}</div>
      {!enabled ? <p className="p-3 text-sm text-muted-foreground">{tw("noNotifications")}</p>
        : list.isError ? <div role="alert" className="space-y-2 p-3"><p className="text-sm text-destructive">{te(errorKey(list.error))}</p><Button variant="outline" size="sm" onClick={() => void list.refetch()}>{t("retry")}</Button></div>
        : list.isPending ? <p role="status" className="p-3 text-sm text-muted-foreground">{t("loading")}</p>
        : !list.data.content.length ? <p className="p-3 text-sm text-muted-foreground">{tw("noNotifications")}</p>
        : list.data.content.map((n) => {
          const href = n.resourceType === "TASK" && n.projectId ? `/tasks?task=${encodeURIComponent(n.resourceId)}&taskProject=${encodeURIComponent(n.projectId)}` : undefined;
          return <DropdownMenuItem key={n.id} render={href ? <Link href={href} /> : undefined} closeOnClick={!!href} onClick={() => { if (!n.read) read.mutate(n.id); }} className="items-start gap-2 py-3 whitespace-normal">
            <span aria-hidden="true" className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-primary")} />
            <NotificationText notification={n} />
          </DropdownMenuItem>;
        })}
      {list.data && list.data.totalPages > 1 && <div className="flex items-center justify-between border-t px-2 pt-2"><Button variant="ghost" size="icon-sm" aria-label={t("previous")} disabled={!page} onClick={() => setPage(page - 1)}><CaretLeft aria-hidden="true" /></Button><span className="text-xs tabular-nums text-muted-foreground">{page + 1} / {list.data.totalPages}</span><Button variant="ghost" size="icon-sm" aria-label={t("next")} disabled={page + 1 >= list.data.totalPages} onClick={() => setPage(page + 1)}><CaretRight aria-hidden="true" /></Button></div>}
    </DropdownMenuContent>
  </DropdownMenu>;
}

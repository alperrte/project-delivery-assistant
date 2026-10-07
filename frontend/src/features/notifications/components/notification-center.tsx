"use client";

import { useEffect, useRef, useState } from "react";
import Link from "@/i18n/navigation";
import { Popover } from "@base-ui/react/popover";
import { Bell, Check, Checks, CaretLeft, CaretRight } from "@phosphor-icons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { errorKey } from "@/lib/api/error-message";
import { ApiError } from "@/lib/api/client";
import { notificationsApi } from "../api";
import { notificationKeys, reconcileNotificationRead } from "../query-keys";
import { useNotificationOwner } from "../notification-owner";
import type { Notification } from "../types";
import { useNotificationRead, type ReadAction } from "../hooks/use-notification-read";
import { useTaskFormat } from "@/features/tasks/format";
import { projectsApi } from "@/features/projects/api";

/** Deep link into the repository page; the slug comes from the project (cached), hidden while unknown or inaccessible. */
function RepositoryLink({ projectId, label, onOpen }: { projectId: string; label: string; onOpen: () => void }) {
  const project = useQuery({ queryKey: ["projects", "detail", projectId], queryFn: () => projectsApi.detail(projectId), retry: false, staleTime: 60_000 });
  if (!project.data?.slug) return null;
  return <Link href={`/projects/${encodeURIComponent(project.data.slug)}?section=repository`}
    className="mt-2 inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4" onClick={onOpen}>{label}</Link>;
}

export function NotificationCenter({ expectedUserId, disabled = false }: { expectedUserId?: string; disabled?: boolean } = {}) {
  const context = useNotificationOwner();
  const owner = disabled || (expectedUserId && context?.userId !== expectedUserId) ? null : context;
  const navigatingTask = useRef(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const focusPlan = useRef<{ origin: HTMLElement; next?: string; view: "new" | "history"; action: ReadAction } | null>(null);
  const userId = owner?.userId;
  const t = useTranslations("notifications");
  const tw = useTranslations("workspace");
  const te = useTranslations("errors");
  const ts = useTranslations("tasks.common.status");
  const locale = useLocale();
  const format = useTaskFormat();
  const client = useQueryClient();
  const [demoOpen, setDemoOpen] = useState(false);
  const [view, setView] = useState<"new" | "history">("new");
  const [pages, setPages] = useState({ new: 0, history: 0 });
  const page = pages[view], filter = { read: view === "history" };
  const setPage = (next: number) => setPages(previous => ({ ...previous, [view]: next }));
  const open = owner ? owner.open : demoOpen;
  const count = useQuery({
    queryKey: notificationKeys.count(userId), queryFn: ({ signal }) => notificationsApi.count(signal),
    enabled: !!userId, refetchInterval: 30_000, refetchIntervalInBackground: false,
  });
  const list = useQuery({
    queryKey: notificationKeys.list(userId, page, filter), queryFn: ({ signal }) => notificationsApi.list(page, signal, filter),
    enabled: !!userId && open,
    staleTime: 0,
    refetchInterval: 15_000, refetchIntervalInBackground: false,
  });
  const totalPages = list.data?.totalPages;
  if (list.isSuccess && totalPages !== undefined && page > 0 && page >= totalPages)
    setPages(previous => ({ ...previous, [view]: Math.max(0, totalPages - 1) }));
  const read = useNotificationRead(owner, error => toast.error(te(errorKey(error))));
  useEffect(() => {
    const plan = focusPlan.current;
    if (!plan || !open || read.isPending || !read.isSuccess || list.isFetching || !owner?.current()) return;
    focusPlan.current = null;
    if (view !== plan.view || !read.data || read.data.action.kind !== plan.action.kind) return;
    const active = document.activeElement;
    if (active !== document.body && !plan.origin.contains(active)) return;
    const panel = popupRef.current;
    const next = plan.next ? panel?.querySelector<HTMLElement>(`[data-notification-read-id="${CSS.escape(plan.next)}"]`) : null;
    const fallback = list.isError ? panel?.querySelector<HTMLElement>("[data-notification-retry]")
      : panel?.querySelector<HTMLElement>("[data-notification-read-id]")
        ?? panel?.querySelector<HTMLElement>("[data-notification-empty]")
        ?? panel?.querySelector<HTMLElement>("[data-notification-panel-heading]");
    (next ?? fallback)?.focus({ preventScroll: true });
  }, [open, read.isPending, read.isSuccess, read.data, list.isFetching, list.isError, view, owner]);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" });
  const message = (error: unknown) => error instanceof ApiError && error.status >= 500 ? t("unavailable") : te(errorKey(error));
  function resetView() { setView("new"); setPages({ new: 0, history: 0 }); }
  function setOpen(next: boolean) {
    focusPlan.current = null;
    resetView();
    if (owner) owner.setOpen(next); else setDemoOpen(next);
    if (next) navigatingTask.current = false;
  }
  function executeRead(action: ReadAction, origin?: HTMLElement) {
    if (!read.execute(action)) return false;
    if (origin?.contains(document.activeElement)) {
      const rows = list.data?.content ?? [];
      const index = action.kind === "read" ? rows.findIndex(n => n.id === action.id) : -1;
      focusPlan.current = { origin, view, action, next: action.kind === "read" ? (rows[index + 1] ?? rows[index - 1])?.id : undefined };
    }
    return true;
  }
  async function retryRefresh() {
    if (!userId || !owner?.current()) return;
    try { await reconcileNotificationRead(client, userId); if (owner.current()) read.reset(); }
    catch { /* Query error states retain their retry affordance; a committed read is not rolled back. */ }
  }

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
    if (n.repositoryCommits) {
      const c = n.repositoryCommits;
      const summary = t(c.truncated ? "repositoryCommitsBodyMore" : "repositoryCommitsBody", { repo: c.repositoryFullName, branch: c.branch, count: c.commitCount });
      if (!c.headMessage) return summary;
      return `${summary}
${c.headAuthor ? t("repositoryCommitsHeadBy", { message: c.headMessage, author: c.headAuthor }) : t("repositoryCommitsHead", { message: c.headMessage })}`;
    }
    return t.has(`bodies.${n.type}`) ? t(`bodies.${n.type}`) : n.message;
  }

  return (
    <Popover.Root modal={false} open={open} onOpenChange={setOpen}>
      <Popover.Trigger aria-label={tw("notifications")} render={<Button variant="ghost" size="icon" className="relative max-sm:size-11" />}>
        <Bell size={18} aria-hidden="true" />
        {count.isSuccess && count.data.count > 0 && <span className="absolute -right-0.5 -top-0.5 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground" aria-label={t("unreadCount", { count: count.data.count })}>{count.data.count > 99 ? "99+" : count.data.count}</span>}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner align="end" sideOffset={8} className="z-50 outline-none">
          <Popover.Popup ref={popupRef} className="w-[min(26rem,calc(100vw-2rem))] max-h-[min(70dvh,32rem)] overflow-y-auto rounded-xl border bg-popover p-4 text-popover-foreground shadow-lg outline-none"
            finalFocus={() => !navigatingTask.current}
            aria-label={t("title")}
            onPointerDownCapture={() => { focusPlan.current = null; }} onKeyDownCapture={() => { focusPlan.current = null; }}
            onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setOpen(false); } }}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold">{t("title")}</h2>
              {!!userId && <Button variant="ghost" size="sm" className="h-auto min-h-11 max-w-full whitespace-normal text-left" disabled={read.isPending || !count.isSuccess || !count.data.count} onClick={event => executeRead({ kind: "all" }, event.currentTarget)}><Checks size={16} aria-hidden="true" />{t("readAll")}</Button>}
            </div>
            {read.isError && <p role="alert" className="mb-3 text-sm text-destructive">{t("readFailed")}</p>}
            {!!read.data?.refreshError && <div className="mb-3 space-y-2"><p role="alert" className="text-sm text-destructive">{t("refreshFailed")}</p><Button variant="outline" className="min-h-11" data-notification-retry onClick={() => void retryRefresh()}>{t("retry")}</Button></div>}
            <Tabs value={view} onValueChange={value => { if (value === "new" || value === "history") setView(value); }}>
              <TabsList className="mb-3 w-full min-h-11 group-data-horizontal/tabs:h-auto" aria-label={t("sections")}>
                <TabsTrigger value="new" disabled={!userId} className="min-h-11">{t("newLabel")}</TabsTrigger>
                <TabsTrigger value="history" disabled={!userId} className="min-h-11">{t("historyLabel")}</TabsTrigger>
              </TabsList>
              <TabsContent value={view}>
            <h3 className="sr-only" tabIndex={-1} data-notification-panel-heading>{t(view === "new" ? "newListLabel" : "historyListLabel")}</h3>
            {list.isLoading && <div role="status" aria-label={t("loading")} className="space-y-2"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>}
            {count.isError && <p role="status" className="mb-2 text-xs text-muted-foreground">{t("countUnavailable")}</p>}
            {list.isError && !read.data?.refreshError && <div className="space-y-2"><p role="alert" className="text-sm text-destructive">{message(list.error)}</p><Button variant="outline" className="min-h-11" data-notification-retry onClick={() => void list.refetch()}>{t("retry")}</Button></div>}
            {!userId && <p className="text-sm text-muted-foreground">{tw("noNotifications")}</p>}
            {list.data && !list.isError && list.data.content.length === 0 && <p role="status" tabIndex={-1} data-notification-empty className="text-sm text-muted-foreground">{t(view === "new" ? "newEmpty" : "historyEmpty")}</p>}
            {list.data && !list.isError && <ul className="space-y-2" aria-label={t(view === "new" ? "newListLabel" : "historyListLabel")}>
              {list.data.content.map(n => <li key={n.id} data-notification-id={n.id} className={`rounded-lg border p-3 ${n.read ? "bg-popover" : "bg-muted/40"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0"><h3 id={`notification-title-${n.id}`} className="break-words text-sm font-medium">{title(n)}</h3><p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">{body(n)}</p>
                    <p className="mt-2 text-xs text-muted-foreground"><time dateTime={n.createdAt} title={Number.isFinite(Date.parse(n.createdAt)) ? date.format(new Date(n.createdAt)) : undefined}>{Number.isFinite(Date.parse(n.createdAt)) ? format.relative(n.createdAt) : ""}</time> · {n.read ? t("read") : t("unread")}</p>
                    {n.resourceType === "TASK" && n.projectId && !!userId && <Link
                      href={`/tasks?task=${encodeURIComponent(n.resourceId)}&taskProject=${encodeURIComponent(n.projectId)}`}
                      className="mt-2 inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4"
                      onClick={event => {
                        if (!owner?.current()) { event.preventDefault(); return; }
                        if (!n.read && !read.execute({ kind: "read", id: n.id })) { event.preventDefault(); return; }
                        navigatingTask.current = true;
                        setOpen(false);
                      }}>{t("openTask")}</Link>}
                    {n.repositoryCommits && n.projectId && !!userId && <RepositoryLink projectId={n.projectId} label={t("openRepository")}
                      onOpen={() => {
                        if (!owner?.current()) return;
                        navigatingTask.current = true;
                        if (!n.read) read.mutate(n.id);
                        owner.setOpen(false);
                      }} />}
                  </div>
                  {!n.read && <Tooltip><TooltipTrigger render={<Button variant="ghost" size="icon" className="min-h-11 min-w-11 shrink-0" aria-label={t("markRead")} aria-describedby={`notification-title-${n.id}`} data-notification-read-id={n.id} disabled={read.isPending} onClick={event => executeRead({ kind: "read", id: n.id }, event.currentTarget)}><Check size={16} aria-hidden="true" /></Button>} /><TooltipContent>{t("markRead")}</TooltipContent></Tooltip>}
                </div>
              </li>)}
            </ul>}
            {list.isSuccess && list.data.totalPages > 1 && <div className="mt-3 flex items-center justify-between gap-2">
              <Button variant="outline" size="icon" className="min-h-11 min-w-11" aria-label={t("previous")} disabled={page === 0} onClick={() => setPage(page - 1)}><CaretLeft size={16} aria-hidden="true" /></Button>
              <span className="text-xs text-muted-foreground">{t("page", { page: list.data.page + 1, total: list.data.totalPages })}</span>
              <Button variant="outline" size="icon" className="min-h-11 min-w-11" aria-label={t("next")} disabled={page + 1 >= list.data.totalPages} onClick={() => setPage(page + 1)}><CaretRight size={16} aria-hidden="true" /></Button>
            </div>}
              </TabsContent>
            </Tabs>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

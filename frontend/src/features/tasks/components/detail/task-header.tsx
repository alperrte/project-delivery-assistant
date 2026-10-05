"use client";

import { useState } from "react";
import Link from "@/i18n/navigation";
import { useRouter } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { buildPath } from "@/i18n/routing";
import type { Locale } from "@/i18n/config";
import { Archive, CaretRight, CircleNotch, DotsThree, Eye, EyeSlash, LinkSimple, PencilSimple } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { tasksApi } from "../../api";
import { useTaskMutation } from "../../hooks";
import { TaskModeBadge } from "../task-mode-picker";
import { BlockedMark, PoolMark, PriorityBadge, StatusBadge } from "../task-badges";
import type { DetailContext } from "./detail-section";

type HeaderProps = DetailContext & { projectName: string };

export function TaskHeader({ task, slug, projectId, perms, projectName, advancedWritable }: HeaderProps) {
  const t = useTranslations("tasks.detail");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [archiving, setArchiving] = useState(false);
  const archived = !!task.archivedAt;

  const watch = useTaskMutation(projectId, () => (task.watching ? tasksApi.unwatch(projectId, task.id) : tasksApi.watch(projectId, task.id)), {
    onSuccess: () => toast.success(t(task.watching ? "unwatched" : "watched", { key: task.taskKey })),
  });

  const archive = useTaskMutation(projectId, () => tasksApi.archive(projectId, task.id), {
    onSuccess: () => {
      toast.success(t("archived", { key: task.taskKey }));
      router.push(`/projects/${slug}/tasks`);
    },
  });

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${buildPath("/projects/[slug]/tasks/[taskId]", { slug, taskId: task.id }, locale)}`);
      toast.success(t("linkCopied"));
    } catch {
      toast.error(t("linkCopyFailed"));
    }
  }

  const WatchIcon = task.watching ? EyeSlash : Eye;

  return (
    <header className="mb-6 space-y-4">
      <nav aria-label={t("breadcrumb")} className="flex min-w-0 flex-wrap items-center gap-1 text-xs text-muted-foreground">
        <Link href={`/projects/${slug}`} className="max-w-48 truncate rounded-sm hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
          {projectName}
        </Link>
        <CaretRight size={10} aria-hidden="true" />
        <Link href={`/projects/${slug}/tasks`} className="rounded-sm hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
          {t("tasks")}
        </Link>
        {task.parent && (
          <>
            <CaretRight size={10} aria-hidden="true" />
            <Link href={`/projects/${slug}/tasks/${task.parent.id}`} title={task.parent.title} className="rounded-sm tabular-nums hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
              {task.parent.key}
            </Link>
          </>
        )}
        <CaretRight size={10} aria-hidden="true" />
        <span aria-current="page" className="font-medium tabular-nums text-foreground">{task.taskKey}</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-3">
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-balance text-foreground sm:text-3xl">{task.title}</h1>
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge status={task.status} />
            <TaskModeBadge mode={task.creationMode} />
            <PriorityBadge priority={task.priority} />
            <BlockedMark task={task} />
            <PoolMark task={task} />
            {archived && (
              <span className="inline-flex h-5 items-center gap-1.5 rounded-md border border-border bg-muted px-1.5 text-xs font-medium text-muted-foreground">
                <Archive size={12} aria-hidden="true" />
                {t("archivedBadge")}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {advancedWritable && !archived && (
            <>
              <Button variant="outline" size="lg" aria-pressed={task.watching} onClick={() => watch.mutate(undefined)} disabled={watch.isPending}>
                <WatchIcon aria-hidden="true" />
                {t(task.watching ? "unwatch" : "watch")}
              </Button>
            </>
          )}
          {perms.manage && !archived && (
            <Link href={`/projects/${slug}/tasks/${task.id}/edit`} className={buttonVariants({ variant: "outline", size: "lg" })}>
              <PencilSimple aria-hidden="true" />
              {t("edit")}
            </Link>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="icon-sm" aria-label={t("moreActions")} />}>
              <DotsThree weight="bold" aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-auto min-w-48">
              <DropdownMenuItem onClick={() => void copyLink()}>
                <LinkSimple aria-hidden="true" />
                {t("copyLink")}
              </DropdownMenuItem>
              {perms.manage && !archived && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => setArchiving(true)}>
                    <Archive aria-hidden="true" />
                    {t("archive")}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Dialog open={archiving} onOpenChange={(open) => !archive.isPending && setArchiving(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("archiveDialog.title", { key: task.taskKey })}</DialogTitle>
            <DialogDescription>{t(task.subtaskCount > 0 ? "archiveDialog.withSubtasks" : "archiveDialog.description", { count: task.subtaskCount })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiving(false)} disabled={archive.isPending}>
              {t("cancel")}
            </Button>
            <Button variant="destructive" onClick={() => archive.mutate(undefined)} disabled={archive.isPending}>
              {archive.isPending && <CircleNotch className="animate-spin" aria-hidden="true" />}
              {t("archiveDialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}

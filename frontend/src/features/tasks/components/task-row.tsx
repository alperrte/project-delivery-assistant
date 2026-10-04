"use client";

import Link from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { ChatCircle, ListChecks, Paperclip, TreeStructure } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { Task } from "../types";
import { priorityDotClass } from "../workflow";
import { StatusMenu } from "./status-menu";
import { AssigneeAvatars, BlockedMark, DeadlineChip, LabelList, PointsBadge, PoolMark, ProgressPill } from "./task-badges";

export function PriorityDot({ priority, className }: { priority: Task["priority"]; className?: string }) {
  const t = useTranslations("tasks.common.priority");
  return (
    <span title={t(priority)} className={cn("inline-flex size-3 shrink-0 items-center justify-center", className)}>
      <span aria-hidden="true" className={cn("size-2 rounded-[3px]", priorityDotClass(priority))} />
      <span className="sr-only">{t(priority)}</span>
    </span>
  );
}

type TaskRowProps = {
  task: Task;
  href: string;
  /** Whether the signed-in user may change the status from the list (assignee or project manager). */
  canChangeStatus: boolean;
  /** Görevlerim shows tasks of many projects, so the project name leads the row. */
  showProject?: boolean;
};

/**
 * One task in a list. The title link stretches over the whole row, so the row is one big click target while the
 * status menu (raised above it) stays independently usable.
 */
export function TaskRow({ task, href, canChangeStatus, showProject }: TaskRowProps) {
  const t = useTranslations("tasks.common");
  const finished = task.status === "DONE";

  return (
    <li className="group/row relative flex flex-col gap-2 px-3 py-2.5 transition-colors hover:bg-muted/50 md:flex-row md:items-center md:gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <span className="relative z-10 md:w-[7.25rem]">
          <StatusMenu task={task} canChange={canChangeStatus} />
        </span>
        <PriorityDot priority={task.priority} />
        <span title={task.taskKey} className="max-w-24 shrink-0 truncate font-mono text-xs tabular-nums text-muted-foreground sm:max-w-40">
          {task.taskKey}
        </span>
        <Link
          href={href}
          className={cn(
            "min-w-0 truncate rounded-sm text-sm font-medium text-foreground outline-none after:absolute after:inset-0 focus-visible:ring-3 focus-visible:ring-ring/50",
            finished && "text-muted-foreground line-through decoration-muted-foreground/40",
          )}
        >
          {task.title}
        </Link>
        <span className="hidden shrink-0 items-center gap-1.5 lg:flex">
          <BlockedMark task={task} />
          <PoolMark task={task} />
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 md:shrink-0 md:justify-end">
        {showProject && task.project && <span className="max-w-40 truncate text-xs text-muted-foreground">{task.project.name}</span>}
        {task.parent && (
          <span className="inline-flex max-w-32 items-center gap-1 truncate text-xs text-muted-foreground" title={`${task.parent.key} ${task.parent.title}`}>
            <TreeStructure size={12} aria-hidden="true" />
            {task.parent.key}
          </span>
        )}
        <span className="lg:hidden">
          <BlockedMark task={task} />
        </span>
        <span className="lg:hidden">
          <PoolMark task={task} />
        </span>
        <LabelList labels={task.labels} max={2} />
        <ProgressPill done={task.subtaskDoneCount} total={task.subtaskCount} label={t("subtasksProgress", { done: task.subtaskDoneCount, total: task.subtaskCount })} />
        {task.checklistTotal > 0 && (
          <span className="inline-flex items-center gap-1 text-xs tabular-nums text-muted-foreground" title={t("checklistProgress", { done: task.checklistDone, total: task.checklistTotal })}>
            <ListChecks size={13} aria-hidden="true" />
            <span aria-hidden="true">
              {task.checklistDone}/{task.checklistTotal}
            </span>
            <span className="sr-only">{t("checklistProgress", { done: task.checklistDone, total: task.checklistTotal })}</span>
          </span>
        )}
        {task.commentCount > 0 && (
          <span className="inline-flex items-center gap-1 text-xs tabular-nums text-muted-foreground" title={t("comments", { count: task.commentCount })}>
            <ChatCircle size={13} aria-hidden="true" />
            <span aria-hidden="true">{task.commentCount}</span>
            <span className="sr-only">{t("comments", { count: task.commentCount })}</span>
          </span>
        )}
        {task.attachmentCount > 0 && (
          <span className="inline-flex items-center gap-1 text-xs tabular-nums text-muted-foreground" title={t("attachments", { count: task.attachmentCount })}>
            <Paperclip size={13} aria-hidden="true" />
            <span aria-hidden="true">{task.attachmentCount}</span>
            <span className="sr-only">{t("attachments", { count: task.attachmentCount })}</span>
          </span>
        )}
        <PointsBadge points={task.estimatePoints} />
        <DeadlineChip task={task} className="md:min-w-24 md:justify-end" />
        <AssigneeAvatars people={task.assignees} />
      </div>
    </li>
  );
}

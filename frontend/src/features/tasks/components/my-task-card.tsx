"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChatCircle, CheckCircle, Play } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Task, TaskStatus } from "../types";
import { allowedTransitions } from "../workflow";
import { AssigneeAvatars, BlockedMark, DeadlineChip, PriorityBadge } from "./task-badges";
import { StatusMenu, useChangeStatus } from "./status-menu";
import { StatusConfirmation } from "./status-confirmation";
import { TaskModeBadge } from "./task-mode-picker";

export function TaskProgressAction({ task, canChange }: { task: Task; canChange: boolean }) {
  const t = useTranslations("tasks.my.cards");
  const change = useChangeStatus(task.projectId);
  const [target, setTarget] = useState<TaskStatus | null>(null);
  const transitions = allowedTransitions(task.status, task.creationMode);
  const next = task.status !== "DONE" && transitions.includes("DONE") ? "DONE"
    : (task.status === "BACKLOG" || task.status === "TODO") && transitions.includes("IN_PROGRESS") ? "IN_PROGRESS" : null;
  if (!canChange || !next) return null;
  const Icon = next === "DONE" ? CheckCircle : Play;
  return <>
    <Button size="sm" disabled={change.isPending} onClick={() => setTarget(next)}><Icon aria-hidden="true" />{t(next === "DONE" ? "complete" : "start")}</Button>
    <StatusConfirmation task={task} target={target} onClose={() => setTarget(null)} onConfirm={(status) => change.mutateAsync({ taskId: task.id, status })} />
  </>;
}

export function MyTaskCard({ task, canChange, onOpen }: { task: Task; canChange: boolean; onOpen: (comments?: boolean) => void }) {
  const t = useTranslations("tasks.my.cards");
  const tc = useTranslations("tasks.common");
  return <li data-task-card={task.id} className={cn("relative flex aspect-square min-h-72 min-w-0 flex-col rounded-xl border bg-card p-4 transition-colors hover:border-border-strong focus-within:border-ring", task.status === "DONE" && "bg-muted/25")}>
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 space-y-1"><p className="truncate text-xs text-muted-foreground" title={task.project?.name}>{task.project?.name}</p><p className="truncate font-mono text-xs text-muted-foreground" title={task.taskKey}>{task.taskKey}</p></div>
      <span className="relative z-10"><StatusMenu task={task} canChange={canChange} /></span>
    </div>
    <h3 className="mt-4 text-base font-semibold leading-6">
      <button type="button" onClick={() => onOpen()} aria-label={`${task.title}, ${t("open", { key: task.taskKey })}`} className="line-clamp-2 text-left break-words outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-3 focus-visible:after:ring-ring/50">{task.title}</button>
    </h3>
    <p className="mt-2 line-clamp-2 text-sm leading-5 break-words text-muted-foreground">{task.description?.trim() || t("noDescription")}</p>
    <div className="mt-auto space-y-3 pt-4">
      <div className="flex flex-wrap items-center gap-1.5"><PriorityBadge priority={task.priority} /><TaskModeBadge mode={task.creationMode} /><BlockedMark task={task} /></div>
      <div className="flex items-center justify-between gap-2"><span><DeadlineChip task={task} /></span><AssigneeAvatars people={task.assignees} /></div>
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <Button variant="ghost" size="sm" onClick={() => onOpen(true)} aria-label={t("comment", { key: task.taskKey })}><ChatCircle aria-hidden="true" />{tc("comments", { count: task.commentCount })}</Button>
        <TaskProgressAction task={task} canChange={canChange} />
      </div>
    </div>
  </li>;
}

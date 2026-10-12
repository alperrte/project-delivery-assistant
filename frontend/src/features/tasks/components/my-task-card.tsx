"use client";

import { useState } from "react";
import Link from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { ChatCircle, CheckCircle, Play } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Task, TaskStatus } from "../types";
import { allowedTransitions } from "../workflow";
import { AssignmentFlow, DeadlineChip, PriorityBadge } from "./task-badges";
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

type CardProps = {
  task: Task;
  canChange: boolean;
  /** Görevlerim: the card opens the task dialog (the flag asks for its comments). */
  onOpen?: (comments?: boolean) => void;
  /** Görevler: the card links to the task page instead. */
  href?: string;
  /** Görevlerim spans many projects, so the project name leads; the project page already is one. */
  showProject?: boolean;
  progress?: boolean;
};

const TITLE = "line-clamp-2 text-left break-words outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-3 focus-visible:after:ring-ring/50";

export function MyTaskCard({ task, canChange, onOpen, href, showProject = true, progress = true }: CardProps) {
  const t = useTranslations("tasks.my.cards");
  const tc = useTranslations("tasks.common");
  const label = `${task.title}, ${t("open", { key: task.taskKey })}`;
  const comments = tc("comments", { count: task.commentCount });
  return <li data-task-card={task.id} className={cn("relative flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-border-strong focus-within:border-ring", task.status === "DONE" && "bg-muted/25")}>
    <div className="flex items-start justify-between gap-2">
      <p className="min-w-0 truncate text-xs text-muted-foreground">{showProject && task.project?.name && <><span title={task.project.name}>{task.project.name}</span><span aria-hidden="true"> · </span></>}<span className="font-mono" title={task.taskKey}>{task.taskKey}</span></p>
      <span className="relative z-10 shrink-0"><StatusMenu task={task} canChange={canChange} /></span>
    </div>
    <div className="min-w-0 space-y-1">
      <h3 className="text-base font-semibold leading-6">
        {href
          ? <Link href={href} aria-label={label} className={TITLE}>{task.title}</Link>
          : <button type="button" onClick={() => onOpen?.()} aria-label={label} className={TITLE}>{task.title}</button>}
      </h3>
      {task.description?.trim() && <p className="line-clamp-1 text-sm break-words text-muted-foreground">{task.description.trim()}</p>}
    </div>
    <div className="flex flex-wrap items-center gap-1.5"><PriorityBadge priority={task.priority} /><TaskModeBadge mode={task.creationMode} /></div>
    <div className="flex items-center justify-between gap-2"><span><DeadlineChip task={task} /></span><AssignmentFlow assigners={task.assigners ?? []} assignees={task.assignees} /></div>
    <div className="relative z-10 mt-auto flex flex-wrap items-center justify-between gap-2 border-t pt-3">
      {onOpen
        ? <Button variant="ghost" size="sm" onClick={() => onOpen(true)} aria-label={t("comment", { key: task.taskKey })}><ChatCircle aria-hidden="true" />{comments}</Button>
        : <span className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ChatCircle size={16} aria-hidden="true" />{comments}</span>}
      {progress && <TaskProgressAction task={task} canChange={canChange} />}
    </div>
  </li>;
}

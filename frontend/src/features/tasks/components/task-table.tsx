"use client";

import type { ReactNode } from "react";
import Link from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { ChatCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { Task } from "../types";
import { TaskProgressAction } from "./my-task-card";
import { StatusMenu } from "./status-menu";
import { AssigneeAvatars, BlockedMark, DeadlineChip, PoolMark, PriorityBadge } from "./task-badges";
import { TaskModeBadge } from "./task-mode-picker";

type TaskTableProps = {
  tasks: Task[];
  /** Accessible name of the table and of the stacked list. */
  label: string;
  /** Whether the signed-in user may change this task's status from the list. */
  canChange: (task: Task) => boolean;
  /** Görevler: the title is a link to the task page. */
  hrefOf?: (task: Task) => string;
  /** Görevlerim: the title (and the comment count) open the task dialog instead. */
  onOpen?: (task: Task, comments?: boolean) => void;
  /** Görevlerim shows tasks of many projects, so the project name sits under the title. */
  showProject?: boolean;
  /** Offer the Başla / Tamamla shortcut, as the Görevlerim cards do. */
  progress?: boolean;
};

function Title({ task, hrefOf, onOpen }: Pick<TaskTableProps, "hrefOf" | "onOpen"> & { task: Task }) {
  const className = cn(
    "block truncate rounded-sm text-left font-medium text-foreground outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50",
    task.status === "DONE" && "text-muted-foreground line-through decoration-muted-foreground/40",
  );
  if (hrefOf) return <Link href={hrefOf(task)} className={className} title={task.title}>{task.title}</Link>;
  return <button type="button" onClick={() => onOpen?.(task)} className={cn(className, "w-full")} title={task.title}>{task.title}</button>;
}

function Comments({ task, onOpen }: { task: Task; onOpen?: TaskTableProps["onOpen"] }) {
  const tc = useTranslations("tasks.common");
  const text = tc("comments", { count: task.commentCount });
  const body = <><ChatCircle size={14} aria-hidden="true" /><span aria-hidden="true">{task.commentCount}</span><span className="sr-only">{text}</span></>;
  if (!onOpen) return <span className="inline-flex items-center gap-1 text-sm tabular-nums text-muted-foreground" title={text}>{body}</span>;
  return <Button variant="ghost" size="sm" className="tabular-nums text-muted-foreground" onClick={() => onOpen(task, true)} title={text}>{body}</Button>;
}

function Marks({ task, showProject }: { task: Task; showProject?: boolean }) {
  // Görevlerim leaves blocked and pool markers out; the project page keeps them next to the title.
  if (showProject) return null;
  return <><BlockedMark task={task} /><PoolMark task={task} /></>;
}

function Meta({ task, showProject }: { task: Task; showProject?: boolean }) {
  return (
    <span className="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
      <span className="shrink-0 font-mono tabular-nums" title={task.taskKey}>{task.taskKey}</span>
      {showProject && task.project && <span className="min-w-0 truncate" title={task.project.name}>· {task.project.name}</span>}
    </span>
  );
}

/**
 * Tasks as a data table: a semantic table from `md` up (the comment count only from `lg`) and stacked `divide-y` rows
 * below `md`, so phones never scroll sideways. Mirrors the Teams table.
 */
export function TaskTable({ tasks, label, canChange, hrefOf, onOpen, showProject, progress }: TaskTableProps) {
  const t = useTranslations("tasks.table");
  const actions = (task: Task): ReactNode => (progress ? <TaskProgressAction task={task} canChange={canChange(task)} /> : null);

  return (
    <>
      <ul className="divide-y rounded-2xl border bg-card shadow-sm md:hidden" aria-label={label} data-testid="tasks-stacked-list">
        {tasks.map((task) => (
          <li key={task.id} className="min-w-0 space-y-3 p-4" data-task-row={task.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <Title task={task} hrefOf={hrefOf} onOpen={onOpen} />
                <Meta task={task} showProject={showProject} />
              </div>
              <StatusMenu task={task} canChange={canChange(task)} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <PriorityBadge priority={task.priority} />
              <TaskModeBadge mode={task.creationMode} />
              <Marks task={task} showProject={showProject} />
            </div>
            <div className="flex items-center justify-between gap-2">
              {task.deadlineAt ? <DeadlineChip task={task} /> : <span className="text-xs text-muted-foreground">{t("noDeadline")}</span>}
              <AssigneeAvatars people={task.assignees} />
            </div>
            {(progress || onOpen) && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                <Comments task={task} onOpen={onOpen} />
                {actions(task)}
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="hidden md:block" data-testid="tasks-table">
        <Table aria-label={label}>
          <TableHeader>
            <TableRow>
              <TableHead className="px-3">{t("task")}</TableHead>
              <TableHead className="px-3">{t("status")}</TableHead>
              <TableHead className="px-3">{t("priority")}</TableHead>
              <TableHead className="px-3">{t("assignees")}</TableHead>
              <TableHead className="px-3">{t("deadline")}</TableHead>
              <TableHead className="hidden px-3 lg:table-cell">{t("comments")}</TableHead>
              {progress && <TableHead className="w-0 px-3 whitespace-nowrap">{t("actions")}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => (
              <TableRow key={task.id} data-task-row={task.id}>
                <TableCell className="min-w-48 max-w-sm px-3 whitespace-normal">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="min-w-0">
                      <Title task={task} hrefOf={hrefOf} onOpen={onOpen} />
                      <Meta task={task} showProject={showProject} />
                    </div>
                    <span className="hidden shrink-0 items-center gap-1.5 xl:flex"><Marks task={task} showProject={showProject} /></span>
                  </div>
                </TableCell>
                <TableCell className="px-3"><StatusMenu task={task} canChange={canChange(task)} /></TableCell>
                <TableCell className="px-3"><PriorityBadge priority={task.priority} /></TableCell>
                <TableCell className="px-3"><AssigneeAvatars people={task.assignees} /></TableCell>
                <TableCell className="px-3">
                  {task.deadlineAt ? <DeadlineChip task={task} /> : (
                    <span className="text-muted-foreground"><span aria-hidden="true">—</span><span className="sr-only">{t("noDeadline")}</span></span>
                  )}
                </TableCell>
                <TableCell className="hidden px-3 lg:table-cell"><Comments task={task} onOpen={onOpen} /></TableCell>
                {progress && <TableCell className="px-3">{actions(task)}</TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

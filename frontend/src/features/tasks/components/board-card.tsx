"use client";

import type { DragEvent } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowsLeftRight } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Task, TaskStatus } from "../types";
import { allowedTransitions } from "../workflow";
import { PriorityDot } from "./task-row";
import { AssigneeAvatars, BlockedMark, DeadlineChip, LabelList, PointsBadge, ProgressPill, StatusDot } from "./task-badges";

type BoardCardProps = {
  task: Task;
  href: string;
  /** The assignee or a manager may move the card: by drag, or with the menu on touch and keyboard. */
  movable: boolean;
  dragging: boolean;
  onMove: (status: TaskStatus) => void;
  onDragStart: (event: DragEvent<HTMLLIElement>) => void;
  onDragEnd: () => void;
};

export function BoardCard({ task, href, movable, dragging, onMove, onDragStart, onDragEnd }: BoardCardProps) {
  const t = useTranslations("tasks.board");
  const tc = useTranslations("tasks.common");
  const targets = allowedTransitions(task.status);

  return (
    <li
      draggable={movable}
      onDragStart={movable ? onDragStart : undefined}
      onDragEnd={movable ? onDragEnd : undefined}
      className={cn(
        "group/card relative space-y-2 rounded-lg border bg-card p-3 shadow-xs transition-[opacity,box-shadow,border-color] duration-200 motion-reduce:transition-none",
        movable && "cursor-grab active:cursor-grabbing",
        dragging ? "opacity-40" : "hover:border-foreground/25 hover:shadow-sm",
      )}
    >
      <div className="flex items-center gap-2">
        <PriorityDot priority={task.priority} />
        <span title={task.taskKey} className="min-w-0 truncate font-mono text-xs tabular-nums text-muted-foreground">
          {task.taskKey}
        </span>
        <span className="ml-auto flex items-center gap-1">
          <BlockedMark task={task} />
          {movable && targets.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" size="icon-xs" className="relative z-10 -my-1 -mr-1.5 text-muted-foreground" aria-label={t("moveCard", { key: task.taskKey })} />}
              >
                <ArrowsLeftRight size={13} aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-auto min-w-44">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>{tc("moveTo")}</DropdownMenuLabel>
                  {targets.map((target) => (
                    <DropdownMenuItem key={target} onClick={() => onMove(target)}>
                      <StatusDot status={target} />
                      {tc(`status.${target}`)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </span>
      </div>

      <Link
        href={href}
        draggable={false}
        className="block rounded-sm text-sm leading-5 font-medium text-foreground outline-none after:absolute after:inset-0 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {task.title}
      </Link>

      {task.labels.length > 0 && <LabelList labels={task.labels} max={2} />}

      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <DeadlineChip task={task} />
        <ProgressPill done={task.subtaskDoneCount} total={task.subtaskCount} label={tc("subtasksProgress", { done: task.subtaskDoneCount, total: task.subtaskCount })} />
        <PointsBadge points={task.estimatePoints} />
        <AssigneeAvatars people={task.assignees} className="ml-auto" />
      </div>
    </li>
  );
}

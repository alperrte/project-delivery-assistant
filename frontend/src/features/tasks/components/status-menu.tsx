"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { CaretDown } from "@phosphor-icons/react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { tasksApi } from "../api";
import { useTaskMutation } from "../hooks";
import type { TaskStatus } from "../types";
import { allowedTransitions, statusBadgeClass } from "../workflow";
import { StatusBadge, StatusDot } from "./task-badges";
import { StatusConfirmation, type StatusTask } from "./status-confirmation";

/** One place that changes a task's status, so every screen reports success and failure the same way. */
export function useChangeStatus(projectId: string) {
  const t = useTranslations("tasks.common");
  return useTaskMutation(projectId, ({ taskId, status }: { taskId: string; status: TaskStatus }) =>
    tasksApi.changeStatus(projectId, taskId, status),
    { onSuccess: (task) => toast.success(t("statusChanged", { key: task.taskKey, status: t(`status.${task.status}`) })) },
  );
}

/**
 * The status chip. With `canChange` it opens the allowed transitions only (the same table the server enforces);
 * without it, it is a plain badge.
 */
export function StatusMenu({ task, canChange, className }: { task: StatusTask; canChange: boolean; className?: string }) {
  const t = useTranslations("tasks.common");
  const change = useChangeStatus(task.projectId);
  const [target, setTarget] = useState<TaskStatus | null>(null);

  if (!canChange) return <StatusBadge status={task.status} className={className} />;

  return (
    <><DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("changeStatus", { status: t(`status.${task.status}`) })}
        disabled={change.isPending}
        className={cn(
          "inline-flex h-5 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-1.5 text-xs font-medium whitespace-nowrap outline-none transition-opacity hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
          statusBadgeClass(task.status),
          className,
        )}
      >
        <StatusDot status={task.status} className="size-1.5" />
        {t(`status.${task.status}`)}
        <CaretDown size={10} weight="bold" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-auto min-w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("moveTo")}</DropdownMenuLabel>
          {allowedTransitions(task.status, task.creationMode).map((target) => (
            <DropdownMenuItem key={target} onClick={() => setTarget(target)}>
              <StatusDot status={target} />
              {t(`status.${target}`)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
    <StatusConfirmation task={task} target={target} onClose={() => setTarget(null)} onConfirm={(status) => change.mutateAsync({ taskId: task.id, status })} />
    </>
  );
}

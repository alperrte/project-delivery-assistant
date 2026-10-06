"use client";

import Link from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { CircleNotch, HandGrabbing } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { tasksApi } from "../api";
import { useTaskMutation } from "../hooks";
import { TaskModeBadge } from "./task-mode-picker";
import type { Task } from "../types";
import { DeadlineChip, LabelList, PointsBadge, PoolMark, PriorityBadge } from "./task-badges";

/** Claiming is atomic on the server; a lost race comes back as 409 and `useTaskMutation` refreshes the lists. */
export function useClaimTask(projectId: string) {
  const t = useTranslations("tasks.pool");
  return useTaskMutation(projectId, (taskId: string) => tasksApi.claim(projectId, taskId), {
    onSuccess: (task) => toast.success(t("claimed", { key: task.taskKey })),
  });
}

type PoolCardProps = {
  task: Task;
  href: string;
  /** Görevlerim lists pool tasks of every project, so the project leads the card. */
  showProject?: boolean;
  readOnly?: boolean;
};

export function PoolCard({ task, href, showProject, readOnly = false }: PoolCardProps) {
  const t = useTranslations("tasks.pool");
  const claim = useClaimTask(task.projectId);

  return (
    <li className="relative flex flex-col gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-foreground/20">
      <div className="flex flex-wrap items-center gap-2">
        <span title={task.taskKey} className="max-w-40 truncate font-mono text-xs tabular-nums text-muted-foreground">
          {task.taskKey}
        </span>
        <PriorityBadge priority={task.priority} />
        <TaskModeBadge mode={task.creationMode} />
        {showProject && task.project && <span className="min-w-0 truncate text-xs text-muted-foreground">{task.project.name}</span>}
      </div>

      <div className="min-w-0 space-y-1">
        <h3 className="text-sm font-semibold leading-5 text-foreground">
          <Link href={href} className="rounded-sm outline-none after:absolute after:inset-0 focus-visible:ring-3 focus-visible:ring-ring/50">
            {task.title}
          </Link>
        </h3>
        {task.description && <p className="line-clamp-2 text-sm leading-5 text-muted-foreground">{task.description}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <PoolMark task={task} />
        <LabelList labels={task.labels} max={2} />
        <PointsBadge points={task.estimatePoints} />
        <DeadlineChip task={task} />
      </div>

      <div className="relative z-10 mt-auto flex items-center justify-between gap-2 border-t pt-3">
        <span className="text-xs text-muted-foreground">{task.pool?.teamName ? t("teamOnly", { team: task.pool.teamName }) : t("everyone")}</span>
        <Button size="sm" disabled={readOnly || claim.isPending} onClick={() => claim.mutate(task.id)}>
          {claim.isPending ? <CircleNotch size={14} className="animate-spin" aria-hidden="true" /> : <HandGrabbing size={14} aria-hidden="true" />}
          {t("claim")}
        </Button>
      </div>
    </li>
  );
}

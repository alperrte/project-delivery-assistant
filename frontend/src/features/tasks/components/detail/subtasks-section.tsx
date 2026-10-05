"use client";

import { useState } from "react";
import Link from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { CircleNotch, Plus } from "@phosphor-icons/react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress, ProgressIndicator, ProgressTrack } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { tasksApi } from "../../api";
import { useSubtasks, useTaskMutation } from "../../hooks";
import { emptyTaskForm, TASK_TITLE_MAX, toTaskPayload } from "../../schemas";
import { AssigneeAvatars, StatusBadge, StatusDot } from "../task-badges";
import { DetailSection, type DetailContext } from "./detail-section";

/** Subtasks are one level deep, so a subtask never shows this section. */
export function SubtasksSection({ task, slug, projectId, perms }: DetailContext) {
  const t = useTranslations("tasks.detail.subtasks");
  const [title, setTitle] = useState("");
  const subtasks = useSubtasks(projectId, task.id);

  const add = useTaskMutation(
    projectId,
    (text: string) => tasksApi.create(projectId, toTaskPayload({ ...emptyTaskForm, title: text, parentTaskId: task.id })),
    { onSuccess: () => setTitle("") },
  );

  const total = task.subtaskCount;
  const done = task.subtaskDoneCount;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const trimmed = title.trim();

  return (
    <DetailSection
      id="detail-subtasks"
      title={t("title")}
      count={total > 0 ? `${done}/${total}` : undefined}
      action={
        perms.manage && !task.archivedAt ? (
          <Link href={`/projects/${slug}/tasks/new?parent=${task.id}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
            {t("detailed")}
          </Link>
        ) : undefined
      }
    >
      {total > 0 && (
        <Progress value={percent} aria-label={t("progress", { done, total })}>
          <ProgressTrack>
            <ProgressIndicator className={cn(done === total && "bg-success")} />
          </ProgressTrack>
        </Progress>
      )}

      {subtasks.isPending ? (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      ) : (subtasks.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {(subtasks.data ?? []).map((subtask) => (
            <li key={subtask.id}>
              <Link
                href={`/projects/${slug}/tasks/${subtask.id}`}
                className="flex items-center gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
              >
                <StatusDot status={subtask.status} />
                <span className="w-16 shrink-0 text-xs tabular-nums text-muted-foreground">{subtask.taskKey}</span>
                <span className={cn("min-w-0 flex-1 truncate", subtask.status === "DONE" && "text-muted-foreground line-through")}>{subtask.title}</span>
                <AssigneeAvatars people={subtask.assignees} max={2} className="hidden sm:inline-flex" />
                <StatusBadge status={subtask.status} className="hidden md:inline-flex" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {perms.manage && !task.archivedAt && (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (trimmed) add.mutate(trimmed);
          }}
        >
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={TASK_TITLE_MAX}
            autoComplete="off"
            placeholder={t("placeholder")}
            aria-label={t("placeholder")}
            className="h-9"
          />
          <Button type="submit" variant="outline" size="lg" disabled={!trimmed || add.isPending}>
            {add.isPending ? <CircleNotch className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
            {t("add")}
          </Button>
        </form>
      )}
    </DetailSection>
  );
}

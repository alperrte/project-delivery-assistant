"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CircleNotch } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { tasksApi } from "../../api";
import { useTaskMutation } from "../../hooks";
import { TASK_ASSIGNEES_MAX } from "../../schemas";
import { AssigneePicker } from "../task-form-fields";
import type { DetailContext } from "./detail-section";

/** Replaces the assignees of a task. The picker is the same one the form uses, so the team filter works here too. */
export function AssigneesDialog({ task, projectId, userId, open, onOpenChange }: Pick<DetailContext, "task" | "projectId" | "userId"> & { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("tasks.detail.panel.assigneesDialog");
  const [ids, setIds] = useState<string[]>(task.assigneeIds);

  const save = useTaskMutation(projectId, (next: string[]) => tasksApi.replaceAssignees(projectId, task.id, next), {
    onSuccess: () => onOpenChange(false),
  });

  const unchanged = ids.length === task.assigneeIds.length && ids.every((id) => task.assigneeIds.includes(id));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (save.isPending) return;
        // Start from what the task has now each time the dialog opens.
        if (next) setIds(task.assigneeIds);
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title", { key: task.taskKey })}</DialogTitle>
          <DialogDescription>{task.pool?.open ? t("poolNote") : t("description")}</DialogDescription>
        </DialogHeader>
        <AssigneePicker projectId={projectId} userId={userId} value={ids} onChange={setIds} max={TASK_ASSIGNEES_MAX} known={task.assignees} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            {t("cancel")}
          </Button>
          <Button onClick={() => save.mutate(ids)} disabled={save.isPending || unchanged}>
            {save.isPending && <CircleNotch className="animate-spin" aria-hidden="true" />}
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

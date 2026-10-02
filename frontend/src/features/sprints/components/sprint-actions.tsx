"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CheckCircle, CircleNotch, PencilSimple, Play, Trash } from "@phosphor-icons/react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { settle } from "@/features/tasks/components/detail/detail-section";
import { useTaskMutation } from "@/features/tasks/hooks";
import { sprintsApi } from "../api";
import type { Sprint } from "../types";
import { CompleteSprintDialog } from "./complete-sprint-dialog";
import { SprintDialog } from "./sprint-dialog";

type SprintActionsProps = {
  projectId: string;
  sprint: Sprint;
  /** Another sprint is running, so this planned one cannot start yet. */
  blockedByActive: boolean;
  /** Describes the reason a planned sprint cannot start; referenced by the disabled button. */
  blockedHintId?: string;
  /** Called after the sprint is archived (the detail page leaves the now missing sprint). */
  onArchived?: () => void;
  size?: "sm" | "default";
};

/** Start, complete, edit and archive, limited to what the sprint's status allows. Only managers get this. */
export function SprintActions({ projectId, sprint, blockedByActive, blockedHintId, onArchived, size = "sm" }: SprintActionsProps) {
  const t = useTranslations("sprints.actions");
  const [editing, setEditing] = useState(false);
  const [completing, setCompleting] = useState(false);

  const start = useTaskMutation(projectId, () => sprintsApi.start(projectId, sprint.id), {
    onSuccess: () => toast.success(t("started", { name: sprint.name })),
  });
  const archive = useTaskMutation(projectId, () => sprintsApi.archive(projectId, sprint.id), {
    onSuccess: () => {
      toast.success(t("archived", { name: sprint.name }));
      onArchived?.();
    },
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {sprint.status === "PLANNED" && (
        <Button size={size} onClick={() => start.mutate(undefined)} disabled={blockedByActive || start.isPending} aria-describedby={blockedByActive ? blockedHintId : undefined}>
          {start.isPending ? <CircleNotch className="animate-spin" aria-hidden="true" /> : <Play weight="fill" aria-hidden="true" />}
          {t("start")}
        </Button>
      )}
      {sprint.status === "ACTIVE" && (
        <Button size={size} onClick={() => setCompleting(true)}>
          <CheckCircle aria-hidden="true" />
          {t("complete")}
        </Button>
      )}
      {sprint.status !== "COMPLETED" && (
        <Button variant="outline" size={size} onClick={() => setEditing(true)}>
          <PencilSimple aria-hidden="true" />
          {t("edit")}
        </Button>
      )}
      {sprint.status === "PLANNED" && sprint.taskCount === 0 && (
        <ConfirmDialog
          destructive
          title={t("archiveTitle", { name: sprint.name })}
          description={t("archiveDescription")}
          confirmLabel={t("archive")}
          cancelLabel={t("cancel")}
          onConfirm={() => archive.mutateAsync(undefined).then(settle, settle)}
          trigger={
            <Button variant="ghost" size={size}>
              <Trash aria-hidden="true" />
              {t("archive")}
            </Button>
          }
        />
      )}

      <SprintDialog projectId={projectId} sprint={sprint} open={editing} onOpenChange={setEditing} />
      {sprint.status === "ACTIVE" && <CompleteSprintDialog projectId={projectId} sprint={sprint} open={completing} onOpenChange={setCompleting} />}
    </div>
  );
}

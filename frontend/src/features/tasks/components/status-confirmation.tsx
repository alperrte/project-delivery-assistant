"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CircleNotch } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Task, TaskStatus } from "../types";
import { canTransition } from "../workflow";
import { StatusBadge } from "./task-badges";

export type StatusTask = Pick<Task, "id" | "projectId" | "status" | "taskKey" | "creationMode">;

/** Shared confirmation for menus, personal cards and board moves. Mutation errors keep the dialog available. */
export function StatusConfirmation({ task, target, onClose, onConfirm }: {
  task: StatusTask;
  target: TaskStatus | null;
  onClose: () => void;
  onConfirm: (target: TaskStatus) => Promise<unknown>;
}) {
  const t = useTranslations("tasks.common.confirmStatus");
  const tc = useTranslations("tasks.common");
  const [pending, setPending] = useState(false);
  const valid = !!target && canTransition(task.status, target, task.creationMode);

  async function confirm() {
    if (!target || !valid || pending) return;
    setPending(true);
    try { await onConfirm(target); onClose(); }
    catch { /* The shared mutation/board reports the error; allow retry or cancellation. */ }
    finally { setPending(false); }
  }

  return <Dialog open={!!target} onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
    <DialogContent showCloseButton={false}>
      <DialogHeader>
        <DialogTitle>{t("title", { key: task.taskKey })}</DialogTitle>
        <DialogDescription>{(valid || pending) && target ? t("description", { status: tc(`status.${target}`) }) : t("stale")}</DialogDescription>
      </DialogHeader>
      {target && <div className="flex flex-wrap items-center gap-3"><StatusBadge status={task.status} /><span aria-hidden="true">→</span><StatusBadge status={target} /></div>}
      {target && (target === "IN_PROGRESS" || target === "DONE") && <p className="text-xs text-muted-foreground">{t("notifyManagers")}</p>}
      <DialogFooter>
        <Button variant="outline" disabled={pending} onClick={onClose}>{t("cancel")}</Button>
        <Button disabled={pending || !valid} onClick={() => void confirm()}>{pending && <CircleNotch className="animate-spin" aria-hidden="true" />}{t("confirm")}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}

"use client";

import { useTranslations } from "next-intl";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleNotch } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { tasksApi } from "../../api";
import { useTaskMutation } from "../../hooks";
import { BLOCK_REASON_MAX, blockSchema, type BlockValues } from "../../schemas";
import type { Task } from "../../types";

/** Flags a task as blocked with an optional reason; unblocking needs no dialog. */
export function BlockDialog({ task, open, onOpenChange }: { task: Task; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("tasks.detail.panel.blockDialog");
  const tv = useTranslations("validation");
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<BlockValues>({ resolver: zodResolver(blockSchema), defaultValues: { reason: "" } });

  const block = useTaskMutation(task.projectId, (reason: string) => tasksApi.setBlocked(task.projectId, task.id, true, reason), {
    onSuccess: () => {
      reset();
      onOpenChange(false);
    },
  });

  const length = useWatch({ control, name: "reason" }).length;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (block.isPending) return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <form onSubmit={handleSubmit((values) => block.mutate(values.reason))} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t("title", { key: task.taskKey })}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="block-reason">{t("reason")}</Label>
            <Textarea id="block-reason" rows={3} maxLength={BLOCK_REASON_MAX} autoFocus aria-invalid={!!errors.reason} placeholder={t("placeholder")} {...register("reason")} />
            <div className="flex items-start justify-between gap-3">
              {errors.reason ? (
                <p role="alert" className="text-sm text-destructive">
                  {tv(errors.reason.message!, { max: BLOCK_REASON_MAX })}
                </p>
              ) : (
                <span />
              )}
              <span className="text-xs text-muted-foreground tabular-nums">
                {length}/{BLOCK_REASON_MAX}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={block.isPending}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={block.isPending}>
              {block.isPending && <CircleNotch className="animate-spin" aria-hidden="true" />}
              {t("confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

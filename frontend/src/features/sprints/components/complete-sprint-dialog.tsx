"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CircleNotch } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTaskMutation } from "@/features/tasks/hooks";
import { sprintsApi } from "../api";
import { useSprints, useSprintSummary } from "../hooks";
import type { CompleteTarget, Sprint } from "../types";

const BACKLOG: CompleteTarget = "BACKLOG";

function CompleteForm({ projectId, sprint, onOpenChange }: { projectId: string; sprint: Sprint; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("sprints.complete");
  const [target, setTarget] = useState<CompleteTarget>(BACKLOG);
  const summary = useSprintSummary(projectId, sprint.id);
  const sprints = useSprints(projectId);

  const planned = (sprints.data ?? []).filter((item) => item.status === "PLANNED" && item.id !== sprint.id);
  const openTasks = summary.data ? summary.data.totalTasks - summary.data.doneTasks : null;

  const complete = useTaskMutation(projectId, () => sprintsApi.complete(projectId, sprint.id, target), {
    onSuccess: () => {
      toast.success(t("done", { name: sprint.name }));
      onOpenChange(false);
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        complete.mutate(undefined);
      }}
      className="space-y-4"
    >
      <DialogHeader>
        <DialogTitle>{t("title", { name: sprint.name })}</DialogTitle>
        <DialogDescription>
          {summary.isPending ? t("loading") : t("description", { done: summary.data?.doneTasks ?? 0, total: summary.data?.totalTasks ?? 0 })}
        </DialogDescription>
      </DialogHeader>

      {openTasks === 0 ? (
        <p className="rounded-lg border bg-muted px-3 py-2.5 text-sm text-muted-foreground">{t("noOpenTasks")}</p>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="complete-target">{t("moveTo", { count: openTasks ?? 0 })}</Label>
          <Select value={target} onValueChange={(next) => next && setTarget(next)} disabled={complete.isPending}>
            <SelectTrigger id="complete-target" className="w-full">
              <SelectValue>
                {(value: string) => (value === BACKLOG ? t("backlog") : (planned.find((item) => item.id === value)?.name ?? t("backlog")))}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={BACKLOG}>{t("backlog")}</SelectItem>
              {planned.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{t("hint")}</p>
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={complete.isPending}>
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={complete.isPending || summary.isPending}>
          {complete.isPending && <CircleNotch className="animate-spin" aria-hidden="true" />}
          {t("confirm")}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Closing a sprint decides where its unfinished tasks go; finished ones stay as the sprint's record. */
export function CompleteSprintDialog({ projectId, sprint, open, onOpenChange }: { projectId: string; sprint: Sprint; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <CompleteForm projectId={projectId} sprint={sprint} onOpenChange={onOpenChange} />
      </DialogContent>
    </Dialog>
  );
}

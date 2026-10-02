"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleNotch, Plus, Trash } from "@phosphor-icons/react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress, ProgressIndicator, ProgressTrack } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { todayKey } from "@/features/reminders/dates";
import { cn } from "@/lib/utils";
import { tasksApi } from "../../api";
import { useTaskFormat } from "../../format";
import { useTaskMutation, useWorklogs } from "../../hooks";
import { canEditOwn } from "../../permissions";
import { estimateMinutes, WORKLOG_NOTE_MAX, worklogSchema, type WorklogValues } from "../../schemas";
import { settle, type DetailContext } from "./detail-section";
import { LockedHint } from "./locked-hint";

function WorklogDialog({ ctx, open, onOpenChange }: { ctx: DetailContext; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { task, projectId } = ctx;
  const t = useTranslations("tasks.detail.time.dialog");
  const tv = useTranslations("validation");
  const today = todayKey();
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<WorklogValues>({
    resolver: zodResolver(worklogSchema),
    defaultValues: { hours: "", minutes: "", workDate: today, note: "" },
  });

  const add = useTaskMutation(
    projectId,
    (values: WorklogValues) =>
      tasksApi.addWorklog(projectId, task.id, {
        minutes: estimateMinutes(values.hours, values.minutes) ?? 0,
        workDate: values.workDate,
        note: values.note.trim() || null,
      }),
    {
      onSuccess: () => {
        reset({ hours: "", minutes: "", workDate: todayKey(), note: "" });
        onOpenChange(false);
      },
    },
  );

  const noteLength = useWatch({ control, name: "note" }).length;
  const durationError = errors.hours ?? errors.minutes;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (add.isPending) return;
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <form onSubmit={handleSubmit((values) => add.mutate(values))} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t("title", { key: task.taskKey })}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="worklog-hours">{t("duration")}</Label>
            <div className="flex items-center gap-2">
              <Input id="worklog-hours" inputMode="numeric" maxLength={5} placeholder="0" autoFocus aria-label={t("hours")} aria-invalid={!!errors.hours} className="w-24" {...register("hours")} />
              <span className="text-sm text-muted-foreground">{t("hoursUnit")}</span>
              <Input inputMode="numeric" maxLength={5} placeholder="0" aria-label={t("minutes")} aria-invalid={!!errors.minutes} className="w-24" {...register("minutes")} />
              <span className="text-sm text-muted-foreground">{t("minutesUnit")}</span>
            </div>
            {durationError && (
              <p role="alert" className="text-sm text-destructive">
                {tv(durationError.message!)}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="worklog-date">{t("date")}</Label>
            <Input id="worklog-date" type="date" max={today} aria-invalid={!!errors.workDate} className="w-44" {...register("workDate")} />
            {errors.workDate && (
              <p role="alert" className="text-sm text-destructive">
                {tv(errors.workDate.message!)}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="worklog-note">{t("note")}</Label>
            <Textarea id="worklog-note" rows={2} maxLength={WORKLOG_NOTE_MAX} placeholder={t("notePlaceholder")} aria-invalid={!!errors.note} {...register("note")} />
            <div className="flex items-start justify-between gap-3">
              {errors.note ? (
                <p role="alert" className="text-sm text-destructive">
                  {tv(errors.note.message!, { max: WORKLOG_NOTE_MAX })}
                </p>
              ) : (
                <span />
              )}
              <span className="text-xs text-muted-foreground tabular-nums">
                {noteLength}/{WORKLOG_NOTE_MAX}
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={add.isPending}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={add.isPending}>
              {add.isPending && <CircleNotch className="animate-spin" aria-hidden="true" />}
              {t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Estimate against logged time, the "log time" action and the entries behind the total. */
export function TimeTracking(ctx: DetailContext) {
  const { task, projectId, userId, isManager, perms } = ctx;
  const t = useTranslations("tasks.detail.time");
  const format = useTaskFormat();
  const [logging, setLogging] = useState(false);
  const worklogs = useWorklogs(projectId, task.id);
  const remove = useTaskMutation(projectId, (id: string) => tasksApi.deleteWorklog(projectId, task.id, id));

  const entries = worklogs.data?.entries ?? [];
  const logged = worklogs.data?.totalMinutes ?? task.loggedMinutes;
  const estimate = task.timeEstimateMinutes;
  const over = estimate !== null && logged > estimate;
  const percent = estimate ? Math.min(100, Math.round((logged / estimate) * 100)) : 0;
  const canLog = perms.work && !task.archivedAt;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm tabular-nums">
          <span className={cn("font-medium", over && "text-destructive")}>{format.duration(logged)}</span>
          <span className="text-muted-foreground"> {estimate !== null ? t("of", { estimate: format.duration(estimate) }) : t("noEstimate")}</span>
        </p>
        <LockedHint locked={!canLog && !task.archivedAt} reason="assignee">
          <Button variant="outline" size="sm" disabled={!canLog} onClick={() => setLogging(true)}>
            <Plus aria-hidden="true" />
            {t("log")}
          </Button>
        </LockedHint>
      </div>

      {estimate !== null && (
        <Progress value={percent} aria-label={t("progress", { logged: format.duration(logged), estimate: format.duration(estimate) })}>
          <ProgressTrack>
            <ProgressIndicator className={cn(over && "bg-destructive")} />
          </ProgressTrack>
        </Progress>
      )}
      {over && <p className="text-xs text-destructive">{t("over", { duration: format.duration(logged - estimate) })}</p>}

      {worklogs.isPending ? (
        <p className="text-xs text-muted-foreground">{t("loading")}</p>
      ) : entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {entries.map((entry) => (
            <li key={entry.id} className="group flex items-start gap-2 px-2.5 py-2">
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="flex flex-wrap items-baseline gap-x-2 text-xs">
                  <span className="font-medium text-foreground tabular-nums">{format.duration(entry.minutes)}</span>
                  <span className="text-muted-foreground">
                    {entry.userName ?? "?"} · {format.day(entry.workDate)}
                  </span>
                </p>
                {entry.note && <p className="text-xs break-words text-muted-foreground">{entry.note}</p>}
              </div>
              {canEditOwn(entry.userId, userId, isManager) && !task.archivedAt && (
                <ConfirmDialog
                  destructive
                  title={t("deleteTitle")}
                  description={t("deleteDescription", { duration: format.duration(entry.minutes), date: format.day(entry.workDate) })}
                  confirmLabel={t("delete")}
                  cancelLabel={t("cancel")}
                  onConfirm={() => remove.mutateAsync(entry.id).then(settle, settle)}
                  trigger={
                    <Button variant="ghost" size="icon-xs" aria-label={t("deleteEntry", { duration: format.duration(entry.minutes), date: format.day(entry.workDate) })} className="sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                      <Trash aria-hidden="true" />
                    </Button>
                  }
                />
              )}
            </li>
          ))}
        </ul>
      )}

      <WorklogDialog ctx={ctx} open={logging} onOpenChange={setLogging} />
    </div>
  );
}

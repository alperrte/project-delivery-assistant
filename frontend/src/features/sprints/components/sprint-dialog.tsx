"use client";

import { useTranslations } from "next-intl";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CircleNotch } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { todayKey } from "@/features/reminders/dates";
import { useTaskMutation } from "@/features/tasks/hooks";
import { sprintsApi } from "../api";
import { addDays } from "../dates";
import { SPRINT_GOAL_MAX, SPRINT_NAME_MAX, sprintFormSchema, toSprintPayload, type SprintFormValues } from "../schemas";
import type { Sprint } from "../types";

const DEFAULT_LENGTH_DAYS = 13;

type SprintDialogProps = {
  projectId: string;
  /** The sprint being edited; without one the dialog creates a sprint. */
  sprint?: Sprint;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function SprintForm({ projectId, sprint, onOpenChange }: Omit<SprintDialogProps, "open">) {
  const t = useTranslations("sprints.dialog");
  const tv = useTranslations("validation");
  const editing = !!sprint;
  const today = todayKey();
  const {
    register,
    handleSubmit,
    control,
    trigger,
    getValues,
    formState: { errors },
  } = useForm<SprintFormValues>({
    resolver: zodResolver(sprintFormSchema),
    defaultValues: {
      name: sprint?.name ?? "",
      goal: sprint?.goal ?? "",
      startDate: sprint?.startDate ?? today,
      endDate: sprint?.endDate ?? addDays(today, DEFAULT_LENGTH_DAYS),
    },
  });

  const save = useTaskMutation(
    projectId,
    (values: SprintFormValues) => {
      const body = toSprintPayload(values);
      return sprint ? sprintsApi.update(projectId, sprint.id, body) : sprintsApi.create(projectId, body);
    },
    {
      onSuccess: (saved) => {
        toast.success(t(editing ? "updated" : "created", { name: saved.name }));
        onOpenChange(false);
      },
    },
  );

  const goalLength = useWatch({ control, name: "goal" }).length;
  const startDate = useWatch({ control, name: "startDate" });

  return (
    <form onSubmit={handleSubmit((values) => save.mutate(values))} noValidate className="space-y-4">
      <DialogHeader>
        <DialogTitle>{editing ? t("editTitle") : t("createTitle")}</DialogTitle>
        <DialogDescription>{t("description")}</DialogDescription>
      </DialogHeader>

      <div className="space-y-1.5">
        <Label htmlFor="sprint-name">{t("name")}</Label>
        <Input id="sprint-name" maxLength={SPRINT_NAME_MAX} autoFocus autoComplete="off" placeholder={t("namePlaceholder")} aria-invalid={!!errors.name} {...register("name")} />
        {errors.name && (
          <p role="alert" className="text-sm text-destructive">
            {tv(errors.name.message!, { max: SPRINT_NAME_MAX })}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sprint-goal">{t("goal")}</Label>
        <Textarea id="sprint-goal" rows={3} maxLength={SPRINT_GOAL_MAX} placeholder={t("goalPlaceholder")} aria-invalid={!!errors.goal} {...register("goal")} />
        <div className="flex items-start justify-between gap-3">
          {errors.goal ? (
            <p role="alert" className="text-sm text-destructive">
              {tv(errors.goal.message!, { max: SPRINT_GOAL_MAX })}
            </p>
          ) : (
            <span />
          )}
          <span className="text-xs text-muted-foreground tabular-nums">
            {goalLength}/{SPRINT_GOAL_MAX}
          </span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="sprint-start">{t("startDate")}</Label>
          <Controller
            control={control}
            name="startDate"
            render={({ field }) => (
              <DatePicker
                id="sprint-start"
                label={t("startDate")}
                value={field.value}
                ref={field.ref}
                onBlur={field.onBlur}
                onChange={(next) => {
                  field.onChange(next);
                  if (errors.startDate) void trigger("startDate");
                  if (getValues("endDate")) void trigger("endDate");
                }}
                invalid={!!errors.startDate}
                describedBy={errors.startDate ? "sprint-start-error" : undefined}
              />
            )}
          />
          {errors.startDate && (
            <p id="sprint-start-error" role="alert" className="text-sm text-destructive">
              {tv(errors.startDate.message!)}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sprint-end">{t("endDate")}</Label>
          <Controller
            control={control}
            name="endDate"
            render={({ field }) => (
              <DatePicker
                id="sprint-end"
                label={t("endDate")}
                value={field.value}
                ref={field.ref}
                onBlur={field.onBlur}
                onChange={(next) => {
                  field.onChange(next);
                  if (errors.endDate) void trigger("endDate");
                }}
                invalid={!!errors.endDate}
                describedBy={errors.endDate ? "sprint-end-error" : undefined}
                min={startDate || undefined}
              />
            )}
          />
          {errors.endDate && (
            <p id="sprint-end-error" role="alert" className="text-sm text-destructive">
              {tv(errors.endDate.message!)}
            </p>
          )}
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending && <CircleNotch className="animate-spin" aria-hidden="true" />}
          {editing ? t("save") : t("create")}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Create or edit a sprint. The form mounts with the dialog, so every open starts from fresh values. */
export function SprintDialog({ open, onOpenChange, ...rest }: SprintDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <SprintForm {...rest} onOpenChange={onOpenChange} />
      </DialogContent>
    </Dialog>
  );
}

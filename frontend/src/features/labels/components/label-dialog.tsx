"use client";

import { useTranslations } from "next-intl";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CircleNotch } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label as FieldLabel } from "@/components/ui/label";
import { LabelChip } from "@/features/tasks/components/task-badges";
import { useTaskMutation } from "@/features/tasks/hooks";
import { labelsApi } from "../api";
import { LABEL_NAME_MAX, labelFormSchema, type LabelFormValues } from "../schemas";
import type { Label } from "../types";
import { LabelColorPicker } from "./label-color-picker";

type LabelDialogProps = {
  projectId: string;
  /** The label being edited; without one the dialog creates a label. */
  label?: Label;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function LabelForm({ projectId, label, onOpenChange }: Omit<LabelDialogProps, "open">) {
  const t = useTranslations("labels.dialog");
  const tv = useTranslations("validation");
  const editing = !!label;
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<LabelFormValues>({
    resolver: zodResolver(labelFormSchema),
    defaultValues: { name: label?.name ?? "", color: label?.color ?? "blue" },
  });

  const save = useTaskMutation(
    projectId,
    (values: LabelFormValues) => {
      const body = { name: values.name.trim(), color: values.color };
      return label ? labelsApi.update(projectId, label.id, body) : labelsApi.create(projectId, body);
    },
    {
      onSuccess: (saved) => {
        toast.success(t(editing ? "updated" : "created", { name: saved.name }));
        onOpenChange(false);
      },
    },
  );

  const [name, color] = useWatch({ control, name: ["name", "color"] });

  return (
    <form onSubmit={handleSubmit((values) => save.mutate(values))} noValidate className="space-y-4">
      <DialogHeader>
        <DialogTitle>{editing ? t("editTitle") : t("createTitle")}</DialogTitle>
        <DialogDescription>{t("description")}</DialogDescription>
      </DialogHeader>

      <div className="space-y-1.5">
        <FieldLabel htmlFor="label-name">{t("name")}</FieldLabel>
        <Input id="label-name" maxLength={LABEL_NAME_MAX} autoFocus autoComplete="off" placeholder={t("namePlaceholder")} aria-invalid={!!errors.name} {...register("name")} />
        <div className="flex items-start justify-between gap-3">
          {errors.name ? (
            <p role="alert" className="text-sm text-destructive">
              {tv(errors.name.message!, { max: LABEL_NAME_MAX })}
            </p>
          ) : (
            <span />
          )}
          <span className="text-xs text-muted-foreground tabular-nums">
            {name.length}/{LABEL_NAME_MAX}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <span id="label-color-heading" className="text-sm font-medium text-foreground">
          {t("color")}
        </span>
        <Controller control={control} name="color" render={({ field }) => <LabelColorPicker name="label-color" label={t("color")} value={field.value} onChange={field.onChange} />} />
      </div>

      <div className="space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">{t("preview")}</span>
        <p>
          <LabelChip label={{ name: name.trim() || t("previewFallback"), color }} />
        </p>
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

/** Create or edit a label. The form mounts with the dialog, so every open starts from fresh values. */
export function LabelDialog({ open, onOpenChange, ...rest }: LabelDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <LabelForm {...rest} onOpenChange={onOpenChange} />
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CircleNotch } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { errorKey } from "@/lib/api/error-message";
import { criteriaApi } from "../api";
import { criterionFormSchema, type CriterionFormValues } from "../schemas";
import type { Criterion } from "../types";

export function CriterionFormDialog({
  trigger,
  projectId,
  criterion,
}: {
  trigger: ReactNode;
  projectId: string;
  criterion?: Criterion;
}) {
  const t = useTranslations("criteria.form");
  const tv = useTranslations("validation");
  const te = useTranslations("errors");
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CriterionFormValues>({
    resolver: zodResolver(criterionFormSchema),
    mode: "onBlur",
    values: criterion
      ? { title: criterion.title, description: criterion.description ?? undefined }
      : { title: "", description: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: CriterionFormValues) =>
      criterion ? criteriaApi.update(projectId, criterion.id, values) : criteriaApi.create(projectId, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "criteria"] });
      toast.success(criterion ? t("updated") : t("created"));
      setOpen(false);
      reset();
    },
    onError: (err) => toast.error(te(errorKey(err))),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent>
        <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>{criterion ? t("editTitle") : t("createTitle")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="criterion-title">{t("titleLabel")}</Label>
            <Input id="criterion-title" aria-invalid={!!errors.title} aria-describedby={errors.title ? "criterion-title-error" : undefined} {...register("title")} />
            {errors.title && <p id="criterion-title-error" role="alert" className="text-sm text-destructive">{tv(errors.title.message!)}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="criterion-description">{t("descriptionLabel")}</Label>
            <Textarea id="criterion-description" rows={3} {...register("description")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <CircleNotch size={16} className="animate-spin" />}
              {criterion ? t("save") : t("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

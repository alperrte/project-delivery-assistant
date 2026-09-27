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
import { squadsApi } from "../api";
import { squadFormSchema, type SquadFormValues } from "../schemas";
import type { Squad } from "../types";

export function SquadFormDialog({
  trigger,
  projectId,
  squad,
}: {
  trigger: ReactNode;
  projectId: string;
  squad?: Squad;
}) {
  const t = useTranslations("squads.form");
  const tv = useTranslations("validation");
  const te = useTranslations("errors");
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SquadFormValues>({
    resolver: zodResolver(squadFormSchema),
    values: squad ? { name: squad.name, description: squad.description ?? undefined } : { name: "", description: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: SquadFormValues) =>
      squad ? squadsApi.update(projectId, squad.id, values) : squadsApi.create(projectId, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "squads"] });
      toast.success(squad ? t("updated") : t("created"));
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
            <DialogTitle>{squad ? t("editTitle") : t("createTitle")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="squad-name">{t("name")}</Label>
            <Input id="squad-name" {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{tv(errors.name.message!)}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="squad-description">{t("description")}</Label>
            <Textarea id="squad-description" rows={3} {...register("description")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <CircleNotch size={16} className="animate-spin" />}
              {squad ? t("save") : t("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

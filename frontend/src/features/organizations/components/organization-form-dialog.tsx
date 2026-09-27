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
import { organizationsApi } from "../api";
import { organizationFormSchema, type OrganizationFormValues } from "../schemas";
import type { Organization } from "../types";

type OrganizationFormDialogProps = {
  trigger: ReactNode;
  organization?: Organization;
};

export function OrganizationFormDialog({ trigger, organization }: OrganizationFormDialogProps) {
  const t = useTranslations("organizations.form");
  const tv = useTranslations("validation");
  const te = useTranslations("errors");
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<OrganizationFormValues>({
    resolver: zodResolver(organizationFormSchema),
    values: organization
      ? { name: organization.name, description: organization.description ?? undefined }
      : { name: "", description: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: OrganizationFormValues) =>
      organization ? organizationsApi.update(organization.id, values) : organizationsApi.create(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      toast.success(organization ? t("updated") : t("created"));
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
            <DialogTitle>{organization ? t("editTitle") : t("createTitle")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="org-name">{t("name")}</Label>
            <Input id="org-name" {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{tv(errors.name.message!)}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="org-description">{t("description")}</Label>
            <Textarea id="org-description" rows={3} {...register("description")} />
            {errors.description && <p className="text-sm text-destructive">{tv(errors.description.message!)}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <CircleNotch size={16} className="animate-spin" />}
              {organization ? t("save") : t("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

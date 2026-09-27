"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { errorKey } from "@/lib/api/error-message";
import { organizationsApi } from "@/features/organizations/api";
import { projectsApi } from "../api";
import { createProjectSchema, type CreateProjectValues } from "../schemas";

export function ProjectCreateDialog({ trigger }: { trigger: ReactNode }) {
  const t = useTranslations("projects.form");
  const tv = useTranslations("validation");
  const te = useTranslations("errors");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: organizations } = useQuery({
    queryKey: ["organizations", "picker"],
    queryFn: () => organizationsApi.list(0, 100),
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateProjectValues>({ resolver: zodResolver(createProjectSchema) });

  const mutation = useMutation({
    mutationFn: (values: CreateProjectValues) => projectsApi.create(values),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success(t("created"));
      setOpen(false);
      reset();
      router.push(`/projects/${project.slug}`);
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
            <DialogTitle>{t("createTitle")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="project-name">{t("name")}</Label>
            <Input id="project-name" {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{tv(errors.name.message!)}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="project-description">{t("description")}</Label>
            <Textarea id="project-description" rows={3} {...register("description")} />
          </div>

          {organizations && organizations.content.length > 0 && (
            <div className="space-y-1.5">
              <Label>{t("organization")}</Label>
              <Controller
                control={control}
                name="organizationId"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("organizationNone")} />
                    </SelectTrigger>
                    <SelectContent>
                      {organizations.content.map((org) => (
                        <SelectItem key={org.id} value={org.id}>
                          {org.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <CircleNotch size={16} className="animate-spin" />}
              {t("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

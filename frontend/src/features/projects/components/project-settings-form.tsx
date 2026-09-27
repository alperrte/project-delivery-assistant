"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleNotch, Archive } from "@phosphor-icons/react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { errorKey } from "@/lib/api/error-message";
import { organizationsApi } from "@/features/organizations/api";
import { projectsApi } from "../api";
import { projectPriorities, projectSettingsSchema, projectStatuses, type ProjectSettingsValues } from "../schemas";
import type { Project } from "../types";

export function ProjectSettingsForm({ project }: { project: Project }) {
  const t = useTranslations("projects.settings");
  const tv = useTranslations("validation");
  const te = useTranslations("errors");
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: organizations } = useQuery({
    queryKey: ["organizations", "picker"],
    queryFn: () => organizationsApi.list(0, 100),
  });

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProjectSettingsValues>({
    resolver: zodResolver(projectSettingsSchema),
    mode: "onBlur",
    defaultValues: {
      name: project.name,
      description: project.description ?? undefined,
      priority: project.priority,
      status: project.status === "ARCHIVED" ? "PLANNING" : project.status,
      startDate: project.startDate ?? undefined,
      targetEndDate: project.targetEndDate ?? undefined,
      projectGoal: project.projectGoal ?? undefined,
      techStack: project.techStack ?? undefined,
      organizationId: project.organizationId ?? undefined,
    },
  });

  const save = useMutation({
    mutationFn: (values: ProjectSettingsValues) => projectsApi.update(project.id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success(t("saved"));
    },
    onError: (err) => toast.error(te(errorKey(err))),
  });

  const archive = useMutation({
    mutationFn: () => projectsApi.archive(project.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success(t("archived"));
      router.push("/projects");
    },
    onError: (err) => toast.error(te(errorKey(err))),
  });

  return (
    <div>
      <PageHeader
        title={t("title")}
        action={
          <ConfirmDialog
            trigger={
              <Button variant="destructive">
                <Archive data-icon="inline-start" size={16} />
                {t("archive")}
              </Button>
            }
            title={t("archiveConfirmTitle")}
            description={t("archiveConfirmDescription")}
            confirmLabel={t("archive")}
            cancelLabel={t("cancel")}
            destructive
            onConfirm={() => archive.mutateAsync()}
          />
        }
      />

      <form
        onSubmit={handleSubmit((values) => save.mutate(values))}
        noValidate
        className="grid max-w-2xl gap-4 sm:grid-cols-2"
      >
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="settings-name">{t("name")}</Label>
          <Input id="settings-name" aria-invalid={!!errors.name} {...register("name")} />
          {errors.name && <p className="text-sm text-destructive">{tv(errors.name.message!)}</p>}
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="settings-description">{t("description")}</Label>
          <Textarea id="settings-description" rows={3} {...register("description")} />
        </div>

        <div className="space-y-1.5">
          <Label>{t("status")}</Label>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full">
                  <SelectValue>{(value: (typeof projectStatuses)[number]) => t(`statusValues.${value}`)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {projectStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {t(`statusValues.${status}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="space-y-1.5">
          <Label>{t("priority")}</Label>
          <Controller
            control={control}
            name="priority"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full">
                  <SelectValue>{(value: (typeof projectPriorities)[number]) => t(`priorityValues.${value}`)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {projectPriorities.map((priority) => (
                    <SelectItem key={priority} value={priority}>
                      {t(`priorityValues.${priority}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="settings-start">{t("startDate")}</Label>
          <Input id="settings-start" type="date" {...register("startDate")} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="settings-end">{t("targetEndDate")}</Label>
          <Input id="settings-end" type="date" aria-invalid={!!errors.targetEndDate} {...register("targetEndDate")} />
          {errors.targetEndDate && <p className="text-sm text-destructive">{tv(errors.targetEndDate.message!)}</p>}
        </div>

        {organizations && organizations.content.length > 0 && (
          <div className="space-y-1.5 sm:col-span-2">
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

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="settings-goal">{t("goal")}</Label>
          <Textarea id="settings-goal" rows={2} {...register("projectGoal")} />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="settings-tech">{t("techStack")}</Label>
          <Textarea id="settings-tech" rows={2} {...register("techStack")} />
        </div>

        <div className="sm:col-span-2">
          <Button type="submit" disabled={isSubmitting || !isDirty}>
            {isSubmitting && <CircleNotch size={16} className="animate-spin" />}
            {t("save")}
          </Button>
        </div>
      </form>
    </div>
  );
}

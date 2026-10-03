"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleNotch, Archive } from "@phosphor-icons/react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { PageContainer } from "@/components/common/page-container";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { SettingsSection } from "@/components/common/settings-section";
import { TagInput } from "@/components/common/tag-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { errorKey } from "@/lib/api/error-message";
import { cn } from "@/lib/utils";
import { organizationsApi } from "@/features/organizations/api";
import { projectsApi } from "../api";
import { BannerField } from "./banner-field";
import { projectPriorities, projectSettingsSchema, projectStatuses, TAGLINE_MAX, type ProjectSettingsValues } from "../schemas";
import { formatTechStack, parseTechStack } from "../tech-stack";
import { PROJECT_TYPES, type Project } from "../types";

const inputClass = "h-10 bg-background px-3";
const textareaClass = "min-h-20 bg-background px-3 py-2.5 leading-6";
const selectClass = "w-full bg-background";

/** Empty text fields default to "" (what the inputs hold), otherwise the form reads as dirty on load. */
function toFormValues(project: Project): ProjectSettingsValues {
  return {
    name: project.name,
    description: project.description ?? "",
    priority: project.priority,
    status: project.status === "ARCHIVED" ? "PLANNING" : project.status,
    startDate: project.startDate ?? "",
    targetEndDate: project.targetEndDate ?? "",
    projectGoal: project.projectGoal ?? "",
    techStack: project.techStack ?? "",
    organizationId: project.organizationId ?? undefined,
    projectType: project.projectType,
    tagline: project.tagline ?? "",
  };
}

function Field({
  id, label, hint, error, className, children,
}: { id: string; label: string; hint?: string; error?: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs leading-5 text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function ProjectSettingsForm({ project }: { project: Project }) {
  const t = useTranslations("projects.settings");
  const tCard = useTranslations("projects.card");
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
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProjectSettingsValues>({
    resolver: zodResolver(projectSettingsSchema),
    mode: "onBlur",
    defaultValues: toFormValues(project),
  });

  const save = useMutation({
    mutationFn: (values: ProjectSettingsValues) => projectsApi.update(project.id, values),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      reset(toFormValues(updated));
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

  const saving = isSubmitting || save.isPending;

  return (
    <PageContainer width="form">
      <PageHeader title={t("title")} />

      <form onSubmit={handleSubmit((values) => save.mutate(values))} noValidate>
        <SettingsSection title={t("sections.general.title")} description={t("sections.general.description")}>
          <div className="grid gap-5 lg:grid-cols-2">
            <Field id="settings-name" label={t("name")} error={errors.name && tv(errors.name.message!)}>
              <Input
                id="settings-name"
                className={inputClass}
                placeholder={t("namePlaceholder")}
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? "settings-name-error" : undefined}
                {...register("name")}
              />
            </Field>
            <Field id="settings-type" label={t("type")}>
              <Controller
                control={control}
                name="projectType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="settings-type" className={selectClass}>
                      <SelectValue>{(value: (typeof PROJECT_TYPES)[number]) => tCard(`types.${value}`)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>{tCard(`types.${type}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field id="settings-tagline" label={t("tagline")} error={errors.tagline && tv(errors.tagline.message!)} className="lg:col-span-2">
              <Input
                id="settings-tagline"
                className={inputClass}
                maxLength={TAGLINE_MAX}
                placeholder={t("taglinePlaceholder")}
                aria-invalid={!!errors.tagline}
                aria-describedby={errors.tagline ? "settings-tagline-error" : undefined}
                {...register("tagline")}
              />
            </Field>
            <Field id="settings-description" label={t("description")} error={errors.description && tv(errors.description.message!)} className="lg:col-span-2">
              <Textarea
                id="settings-description"
                rows={3}
                className={textareaClass}
                placeholder={t("descriptionPlaceholder")}
                aria-invalid={!!errors.description}
                {...register("description")}
              />
            </Field>
            <Field id="settings-goal" label={t("goal")} hint={t("goalHint")} error={errors.projectGoal && tv(errors.projectGoal.message!)} className="lg:col-span-2">
              <Textarea
                id="settings-goal"
                rows={3}
                className={textareaClass}
                placeholder={t("goalPlaceholder")}
                aria-invalid={!!errors.projectGoal}
                aria-describedby="settings-goal-hint"
                {...register("projectGoal")}
              />
            </Field>
          </div>
        </SettingsSection>

        <SettingsSection title={t("sections.banner.title")} description={t("sections.banner.description")}>
          <BannerField project={project} />
        </SettingsSection>

        <SettingsSection title={t("sections.planning.title")} description={t("sections.planning.description")}>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="settings-status" label={t("status")}>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="settings-status" className={selectClass}>
                      <SelectValue>{(value: (typeof projectStatuses)[number]) => t(`statusValues.${value}`)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {projectStatuses.map((status) => (
                        <SelectItem key={status} value={status}>{t(`statusValues.${status}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field id="settings-priority" label={t("priority")}>
              <Controller
                control={control}
                name="priority"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="settings-priority" className={selectClass}>
                      <SelectValue>{(value: (typeof projectPriorities)[number]) => t(`priorityValues.${value}`)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {projectPriorities.map((priority) => (
                        <SelectItem key={priority} value={priority}>{t(`priorityValues.${priority}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field id="settings-start" label={t("startDate")}>
              <Input id="settings-start" type="date" className={inputClass} {...register("startDate")} />
            </Field>

            <Field id="settings-end" label={t("targetEndDate")} error={errors.targetEndDate && tv(errors.targetEndDate.message!)}>
              <Input
                id="settings-end"
                type="date"
                className={inputClass}
                aria-invalid={!!errors.targetEndDate}
                aria-describedby={errors.targetEndDate ? "settings-end-error" : undefined}
                {...register("targetEndDate")}
              />
            </Field>

            {organizations && organizations.content.length > 0 && (
              <Field id="settings-organization" label={t("organization")} className="sm:col-span-2">
                <Controller
                  control={control}
                  name="organizationId"
                  render={({ field }) => (
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <SelectTrigger id="settings-organization" className={selectClass}>
                        <SelectValue placeholder={t("organizationNone")}>
                          {(value: string) => organizations.content.find((org) => org.id === value)?.name ?? t("organizationNone")}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {organizations.content.map((org) => (
                          <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            )}
          </div>
        </SettingsSection>

        <SettingsSection title={t("sections.technology.title")} description={t("sections.technology.description")}>
          <Field id="settings-tech" label={t("techStack")} hint={t("techStackHint")} error={errors.techStack && tv(errors.techStack.message!)}>
            <Controller
              control={control}
              name="techStack"
              render={({ field }) => (
                <TagInput
                  id="settings-tech"
                  value={parseTechStack(field.value)}
                  onChange={(items) => field.onChange(formatTechStack(items))}
                  placeholder={t("techStackPlaceholder")}
                  removeLabel={(tag) => t("techStackRemove", { name: tag })}
                  aria-describedby="settings-tech-hint"
                />
              )}
            />
          </Field>
        </SettingsSection>

        {/* Room for the save bar once it rests at the end of the form; it floats over this gap, not over the fields. */}
        <div aria-hidden="true" className="h-16" />
        {isDirty && (
          <div data-sticky-actions className="sticky bottom-4 z-20 h-0">
            <div
              role="region"
              aria-label={t("unsaved")}
              className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-strong bg-popover/95 px-4 py-3 shadow-lg backdrop-blur animate-fade-up"
            >
              <p className="text-sm font-medium text-foreground">{t("unsaved")}</p>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" disabled={saving} onClick={() => reset()}>
                  {t("discard")}
                </Button>
                <Button type="submit" disabled={saving}>
                  {save.isPending && <CircleNotch size={16} className="animate-spin" />}
                  {t("save")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </form>

      <SettingsSection title={t("sections.danger.title")} description={t("sections.danger.description")}>
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{t("dangerTitle")}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{t("dangerDescription")}</p>
          </div>
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
        </div>
      </SettingsSection>
    </PageContainer>
  );
}

"use client";

import { useMemo, type ReactNode } from "react";
import { useRouter } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useForm, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleNotch, Eye, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { PageContainer } from "@/components/common/page-container";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { TaskModelSetting } from "./task-model-setting";
import { SettingsSection } from "@/components/common/settings-section";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSession } from "@/features/auth/hooks/use-session";
import { errorKey } from "@/lib/api/error-message";
import { cn } from "@/lib/utils";
import { organizationsApi } from "@/features/organizations/api";
import { RepositorySetting } from "@/features/repository/components/repository-setting";
import { projectBannerUrl, projectLogoSource, projectsApi } from "../api";
import { invalidateProjectMutation } from "../query-invalidation";
import { forgetSelectedProject } from "../hooks/use-selected-project";
import { ProjectLogoField } from "./project-logo-field";
import { BannerField } from "./banner-field";
import { ProjectPreviewPanel } from "./project-preview-panel";
import { ProjectTechDialog } from "./project-tech-dialog";
import { TechLogo, toTechLabels } from "./tech-logo";
import type { ProjectCardData } from "./project-card";
import { projectPriorities, projectSettingsSchema, projectStatuses, TAGLINE_MAX, type ProjectSettingsValues } from "../schemas";
import { canonicalTech } from "../tech-catalog";
import { formatTechStack, parseTechStack } from "../tech-stack";
import { PROJECT_TYPES, type Project, type OrganizationSummary } from "../types";

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

export function ProjectSettingsForm({ project, organization }: { project: Project; organization?: OrganizationSummary | null }) {
  const t = useTranslations("projects.settings");
  const tCard = useTranslations("projects.card");
  const tv = useTranslations("validation");
  const te = useTranslations("errors");
  const tp = useTranslations("projects.newPage");
  const router = useRouter();
  const queryClient = useQueryClient();
  const locale = useLocale();
  const { data: user } = useSession();
  // Only the founder may delete; the server enforces it, the page just does not offer what would be refused.
  const founder = user?.id === project.createdBy;

  const { data: organizations } = useQuery({
    queryKey: ["organizations", "picker"],
    queryFn: () => organizationsApi.allOwned(),
  });

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    trigger,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProjectSettingsValues>({
    resolver: zodResolver(projectSettingsSchema),
    mode: "onBlur",
    defaultValues: toFormValues(project),
  });

  const save = useMutation({
    // The goal is no longer edited here, but the update replaces the whole project: send the stored text back untouched.
    mutationFn: (values: ProjectSettingsValues) =>
      projectsApi.update(project.id, { ...values, projectGoal: project.projectGoal, organizationId: values.organizationId ?? null }),
    onSuccess: async (updated) => {
      await invalidateProjectMutation(queryClient, project.organizationId, updated.organizationId);
      reset(toFormValues(updated));
      toast.success(t("saved"));
    },
    onError: (err) => toast.error(te(errorKey(err))),
  });

  const remove = useMutation({
    mutationFn: () => projectsApi.remove(project.id),
    onSuccess: async () => {
      // The project is gone: drop only its own cache entries (everything else stays warm), stop selecting it, and
      // leave with replace so Back does not return to a settings page for a project that no longer exists.
      if (user) forgetSelectedProject(user.id, project.slug);
      queryClient.removeQueries({ queryKey: ["projects", "by-slug", project.slug] });
      queryClient.removeQueries({ queryKey: ["projects", "detail", project.id] });
      queryClient.removeQueries({ queryKey: ["projects", project.id] });
      toast.success(t("deleted"));
      router.replace("/projects");
      await invalidateProjectMutation(queryClient, project.organizationId);
    },
    onError: (err) => toast.error(te(errorKey(err))),
  });

  const watched = useWatch({ control });
  const techLabels = canonicalTech(parseTechStack(watched.techStack));
  const previewProject = useMemo<ProjectCardData>(
    () => ({
      id: project.id,
      slug: project.slug,
      name: watched.name?.trim() || tp("preview.namePlaceholder"),
      tagline: watched.tagline?.trim() || null,
      description: watched.description?.trim() || null,
      projectGoal: project.projectGoal,
      status: watched.status ?? project.status,
      priority: watched.priority ?? project.priority,
      projectType: watched.projectType ?? project.projectType,
      techStack: watched.techStack || null,
      logoVersion: project.logoVersion,
      bannerVersion: project.bannerVersion,
      team: project.team,
      updatedBy: project.updatedBy,
      updatedAt: project.updatedAt,
    }),
    [project, watched.name, watched.tagline, watched.description, watched.status, watched.priority, watched.projectType, watched.techStack, tp],
  );
  const updatedLabel = new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(project.updatedAt));

  const saving = isSubmitting || save.isPending;
  const currentOrganizationName = organizations?.content.find(org => org.id === project.organizationId)?.name
    ?? (organization?.id === project.organizationId ? organization.name : t("organizationUnavailable"));

  return (
    <PageContainer width="wide">
      <PageHeader title={t("title")} />

      <form id="project-settings-form" onSubmit={handleSubmit((values) => save.mutate(values))} noValidate className="grid gap-8 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-7">
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
            </div>
          </SettingsSection>

          <SettingsSection title={t("sections.logo.title")} description={t("sections.logo.description")}>
            <ProjectLogoField project={project} />
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
                <Controller
                  control={control}
                  name="startDate"
                  render={({ field }) => (
                    <DatePicker
                      id="settings-start"
                      label={t("startDate")}
                      value={field.value ?? ""}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      onChange={(next) => {
                        setValue("startDate", next, { shouldDirty: true, shouldValidate: true });
                        // The end date's order check depends on this one.
                        void trigger("targetEndDate");
                      }}
                    />
                  )}
                />
              </Field>

              <Field id="settings-end" label={t("targetEndDate")} error={errors.targetEndDate && tv(errors.targetEndDate.message!)}>
                <Controller
                  control={control}
                  name="targetEndDate"
                  render={({ field }) => (
                    <DatePicker
                      id="settings-end"
                      label={t("targetEndDate")}
                      value={field.value ?? ""}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      invalid={!!errors.targetEndDate}
                      describedBy={errors.targetEndDate ? "settings-end-error" : undefined}
                      onChange={(next) => setValue("targetEndDate", next, { shouldDirty: true, shouldValidate: true })}
                    />
                  )}
                />
              </Field>

              {(
                <Field id="settings-organization" label={t("organization")} className="sm:col-span-2">
                  <Controller
                    control={control}
                    name="organizationId"
                    render={({ field }) => (
                      <Select value={field.value ?? "__standalone__"} disabled={!organizations} onValueChange={(value) => field.onChange(value === "__standalone__" ? undefined : value)}>
                        <SelectTrigger id="settings-organization" className={selectClass}>
                          <SelectValue placeholder={t("organizationNone")}>
                            {(value: string) => value === "__standalone__" ? t("organizationNone")
                              : organizations?.content.find(org => org.id === value)?.name ?? currentOrganizationName}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__standalone__">{t("organizationNone")}</SelectItem>
                          {project.organizationId && !organizations?.content.some(org => org.id === project.organizationId) &&
                            <SelectItem value={project.organizationId}>{currentOrganizationName}</SelectItem>}
                          {(organizations?.content ?? []).map((org) => (
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
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p id="settings-tech-label" className="text-sm font-medium">{t("techStack")}</p>
                <ProjectTechDialog
                  type={watched.projectType}
                  value={techLabels}
                  onApply={(next) => setValue("techStack", formatTechStack(next), { shouldDirty: true, shouldValidate: true })}
                />
              </div>
              {techLabels.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("techNone")}</p>
              ) : (
                <ul aria-labelledby="settings-tech-label" className="flex flex-wrap gap-2">
                  {toTechLabels(techLabels).map(({ label, tech }) => (
                    <li key={label} className="inline-flex h-9 items-center gap-2 rounded-lg border bg-card px-2.5 text-sm font-medium text-foreground">
                      {tech && <TechLogo tech={tech} />}
                      {tech?.name ?? label}
                    </li>
                  ))}
                </ul>
              )}
              {errors.techStack && <p role="alert" className="text-sm text-destructive">{tv(errors.techStack.message!)}</p>}
            </div>
          </SettingsSection>

  
        <RepositorySetting projectId={project.id} projectSlug={project.slug} />

        <TaskModelSetting project={project} />

        {founder && (
          <SettingsSection title={t("sections.danger.title")} description={t("sections.danger.description")}>
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{t("dangerTitle")}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{t("dangerDescription")}</p>
              </div>
              <ConfirmDialog
                trigger={
                  <Button variant="destructive">
                    <Trash data-icon="inline-start" size={16} />
                    {t("delete")}
                  </Button>
                }
                title={t("deleteConfirmTitle")}
                description={t("deleteConfirmDescription")}
                confirmLabel={t("deleteConfirm")}
                cancelLabel={t("cancel")}
                destructive
                requireText={{
                  value: project.name,
                  label: t.rich("deleteTypeName", {
                    name: project.name,
                    strong: (chunks) => <strong className="font-semibold text-foreground">{chunks}</strong>,
                  }),
                }}
                onConfirm={() => remove.mutateAsync()}
              />
            </div>
          </SettingsSection>
        )}
        </div>

        <ProjectPreviewPanel
          title={tp("preview.title")}
          caption={t("previewCaption")}
          project={previewProject}
          preview={{
            logoSrc: projectLogoSource(project),
            bannerSrc: project.bannerVersion != null ? projectBannerUrl(project.id, project.bannerVersion) : null,
            updatedLabel,
          }}
        />
        {/* It spans both columns. Room is left for it once it rests at the end of the page; it floats over this gap, not over the fields. */}
        <div aria-hidden="true" className="h-16 lg:col-span-12" />
        {isDirty && (
          <div data-sticky-actions className="sticky bottom-4 z-20 h-0 lg:col-span-12">
            <div
              role="region"
              aria-label={t("unsaved")}
              className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-strong bg-popover/95 px-4 py-3 shadow-lg backdrop-blur animate-fade-up"
            >
              <p className="text-sm font-medium text-foreground">{t("unsaved")}</p>
              <div className="flex flex-wrap items-center gap-2">
                <a href="#project-preview" className={buttonVariants({ variant: "ghost", className: "lg:hidden" })}>
                  <Eye size={16} data-icon="inline-start" aria-hidden="true" />
                  <span className="sr-only min-[440px]:not-sr-only">{tp("preview.show")}</span>
                </a>
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
    </PageContainer>
  );
}

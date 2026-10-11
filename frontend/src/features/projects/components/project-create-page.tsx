"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { usePickedImage } from "@/lib/media/use-picked-image";
import Link from "@/i18n/navigation";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleNotch, Eye } from "@phosphor-icons/react";
import { toast } from "sonner";
import { FormErrorSummary, focusFormSection, type FormErrorSection } from "@/components/common/form-error-summary";
import { PageHeader } from "@/components/common/page-header";
import { StickyFormActions } from "@/components/common/sticky-form-actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/features/auth/hooks/use-session";
import { organizationsApi } from "@/features/organizations/api";
import { repositoryApi } from "@/features/repository/api";
import { DEFAULT_REPOSITORY_SETTINGS, RepositoryOptions } from "@/features/repository/components/repository-options";
import { GITHUB_REPOSITORY_URL } from "@/features/repository/schemas";
import type { RepositorySettings } from "@/features/repository/types";
import { errorKey } from "@/lib/api/error-message";
import { projectsApi } from "../api";
import { invalidateProjectMutation } from "../query-invalidation";
import { createProjectSchema, projectPriorities, projectStatuses, TAGLINE_MAX, type CreateProjectValues } from "../schemas";
import { MAX_TECH_SELECTION } from "../tech-catalog";
import { formatTechStack } from "../tech-stack";
import type { UserRef } from "../types";
import { BannerPickField } from "./create/banner-pick-field";
import { LogoField } from "./create/logo-field";
import { TechPicker } from "./create/tech-picker";
import { TypePicker } from "./create/type-picker";
import type { ProjectCardData } from "./project-card";
import { ProjectPreviewPanel } from "./project-preview-panel";
import { TaskModelOptions } from "./task-model-setting";

/** What a new project starts with: the same values the server would pick, and the settings page's "both" task policy. */
const DEFAULT_VALUES = {
  name: "",
  tagline: "",
  techStack: [],
  description: "",
  status: "PLANNING",
  priority: "MEDIUM",
  startDate: "",
  targetEndDate: "",
  taskManagementMode: "BOTH",
} satisfies Partial<CreateProjectValues>;

/** Mirrors the server's slug rules closely enough for a hint; the server appends a random suffix. */
function slugHint(name: string): string {
  return name
    .trim()
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function Section({ id, title, description, children }: { id: string; title: string; description: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-4 border-t pt-6 first:border-t-0 first:pt-0">
      <div className="space-y-1">
        <h2 id={id} className="font-heading text-base font-semibold text-foreground">
          {title}
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function ProjectCreatePage({ presentationValues }: { presentationValues?: Partial<CreateProjectValues> } = {}) {
  const t = useTranslations("projects.newPage");
  const ts = useTranslations("projects.settings");
  const tm = useTranslations("taskModels");
  const tv = useTranslations("validation");
  const tfs = useTranslations("forms.summary");
  const te = useTranslations("errors");
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: user } = useSession();
  const ids = useId();

  const { file: logoFile, url: logoUrl, change: changeLogo } = usePickedImage();
  const { file: bannerFile, url: bannerUrl, change: changeBanner } = usePickedImage();

  const { data: organizations } = useQuery({
    queryKey: ["organizations", "picker"],
    queryFn: () => organizationsApi.allOwned(),
  });

  const {
    register,
    handleSubmit,
    control,
    setValue,
    trigger,
    formState: { errors, isDirty, submitCount },
  } = useForm<CreateProjectValues>({
    resolver: zodResolver(createProjectSchema),
    // Focus moves to the first invalid field in page order after a failed submit (see the effect below).
    shouldFocusError: false,
    defaultValues: DEFAULT_VALUES,
    values: presentationValues ? ({ ...DEFAULT_VALUES, ...presentationValues } as CreateProjectValues) : undefined,
  });

  const values = useWatch({ control });
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [repositoryUrlInvalid, setRepositoryUrlInvalid] = useState(false);
  const [repositorySettings, setRepositorySettings] = useState<RepositorySettings>(DEFAULT_REPOSITORY_SETTINGS);
  const [teamPromptSlug, setTeamPromptSlug] = useState<string | null>(null);
  const dirty = isDirty || logoFile !== null || bannerFile !== null || repositoryUrl.trim() !== "";

  const mutation = useMutation({
    mutationFn: async (form: CreateProjectValues) => {
      const project = await projectsApi.create({
        name: form.name.trim(),
        projectType: form.projectType,
        tagline: form.tagline?.trim() || undefined,
        description: form.description?.trim() || undefined,
        organizationId: form.organizationId || undefined,
        techStack: formatTechStack(form.techStack) || undefined,
      });
      // The create endpoint only takes the identity fields; planning and the task policy go through the same calls the
      // settings page uses, so a project created here ends up exactly as if it had been edited there.
      let planningFailed = false;
      const planned = form.status !== "PLANNING" || form.priority !== "MEDIUM" || !!form.startDate || !!form.targetEndDate;
      if (planned) {
        try {
          await projectsApi.update(project.id, {
            name: project.name,
            description: project.description ?? undefined,
            priority: form.priority,
            status: form.status,
            startDate: form.startDate || null,
            targetEndDate: form.targetEndDate || null,
            projectGoal: project.projectGoal,
            techStack: project.techStack,
            organizationId: project.organizationId,
            projectType: project.projectType,
            tagline: project.tagline,
          });
        } catch {
          planningFailed = true;
        }
      }
      let taskModeFailed = false;
      try {
        await projectsApi.setTaskManagementMode(project.id, form.taskManagementMode);
      } catch {
        taskModeFailed = true;
      }
      let logoFailed = false;
      if (logoFile) {
        try {
          await projectsApi.uploadLogo(project.id, logoFile);
        } catch {
          logoFailed = true;
        }
      }
      let bannerFailed = false;
      if (bannerFile) {
        try {
          await projectsApi.uploadBanner(project.id, bannerFile);
        } catch {
          bannerFailed = true;
        }
      }
      let repositoryFailed = false;
      const url = repositoryUrl.trim();
      if (url) {
        try {
          await repositoryApi.connect(project.id, { repositoryUrl: url, ...repositorySettings });
        } catch {
          repositoryFailed = true;
        }
      }
      return { project, planningFailed, taskModeFailed, logoFailed, bannerFailed, repositoryFailed };
    },
    onSuccess: async ({ project, planningFailed, taskModeFailed, logoFailed, bannerFailed, repositoryFailed }) => {
      created.current = true;
      await invalidateProjectMutation(queryClient, project.organizationId);
      toast.success(t("actions.created"));
      if (planningFailed) toast.warning(t("actions.planningFailed"));
      if (taskModeFailed) toast.warning(t("actions.taskModeFailed"));
      if (logoFailed) toast.warning(t("actions.logoFailed"));
      if (bannerFailed) toast.warning(t("actions.bannerFailed"));
      if (repositoryFailed) toast.warning(t("actions.repositoryFailed"));
      setTeamPromptSlug(project.slug);
    },
    onError: (err) => toast.error(te(errorKey(err))),
  });

  const created = useRef(false);
  // The landing demo renders this page with scripted values; nothing there is the visitor's work, so it never warns.
  const leaving = !presentationValues && dirty && !mutation.isPending && !mutation.isSuccess;
  useEffect(() => {
    if (!leaving) return;
    // `created` flips synchronously, before React has re-rendered, so a navigation right after saving never warns.
    const warn = (event: BeforeUnloadEvent) => {
      if (!created.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [leaving]);

  const author: UserRef = { userId: user?.id ?? "me", nickname: user?.nickname ?? t("preview.you") };
  const name = (values.name ?? "").trim();
  const slug = slugHint(name);

  const previewProject = useMemo<ProjectCardData>(
    () => ({
      id: "preview",
      slug: "preview",
      name: name || t("preview.namePlaceholder"),
      tagline: values.tagline?.trim() || t("preview.taglinePlaceholder"),
      description: values.description?.trim() || null,
      projectGoal: null,
      status: values.status ?? "PLANNING",
      priority: values.priority ?? "MEDIUM",
      projectType: values.projectType ?? null,
      techStack: formatTechStack((values.techStack ?? []).filter((item): item is string => typeof item === "string")) || null,
      logoVersion: null,
      team: { memberCount: 1, preview: [author] },
      updatedBy: author,
      updatedAt: new Date().toISOString(),
    }),
    // `author` is derived from the session; keying on its fields keeps the memo stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [name, values.tagline, values.description, values.status, values.priority, values.projectType, values.techStack, author.userId, author.nickname, t],
  );

  const taglineLength = values.tagline?.length ?? 0;
  const typeLabelId = `${ids}-type`;
  const taskModelId = `${ids}-task-model`;

  /** Validates the optional repository URL (not part of the zod schema) and reports whether it is invalid. */
  function checkRepositoryUrl() {
    const invalid = repositoryUrl.trim() !== "" && !GITHUB_REPOSITORY_URL.test(repositoryUrl.trim());
    setRepositoryUrlInvalid(invalid);
    return invalid;
  }

  // Sections with errors, in page order. Only errors that exist after a submit attempt can appear here.
  const summaryId = `${ids}-summary`;
  const sectionHeadingIds = {
    identity: `${ids}-identity`,
    type: typeLabelId,
    technology: `${ids}-technology`,
    planning: `${ids}-planning`,
    details: `${ids}-details`,
    repository: `${ids}-repository`,
  } as const;
  const failedSections: Record<keyof typeof sectionHeadingIds, boolean> = {
    identity: !!(errors.name || errors.tagline),
    type: !!errors.projectType,
    technology: !!errors.techStack,
    planning: !!(errors.targetEndDate || errors.organizationId),
    details: !!errors.description,
    repository: repositoryUrlInvalid,
  };
  const summarySections: FormErrorSection[] = (Object.keys(sectionHeadingIds) as (keyof typeof sectionHeadingIds)[])
    .filter((key) => failedSections[key])
    .map((key) => ({ id: key, label: t(`sections.${key}.title`), focus: () => focusFormSection(sectionHeadingIds[key]) }));

  // react-hook-form bumps `submitCount` together with the final errors state, so by the time this effect runs `aria-invalid` is
  // rendered and the first failed section (page order) can focus its first invalid field. A valid submit has no failed sections,
  // and typing between submits never changes `submitCount`, so focus is never moved at other times.
  useEffect(() => {
    summarySections[0]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitCount]);

  return (
    <div>
      <PageHeader title={t("title")} description={t("description")} />

      <form
        onSubmit={handleSubmit(
          (form) => {
            if (!checkRepositoryUrl()) mutation.mutate(form);
          },
          () => {
            // The repository URL lives outside react-hook-form, so it is checked on this path too and both errors show together.
            checkRepositoryUrl();
          },
        )}
        noValidate
      >
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="space-y-8 lg:col-span-7">
            <Section id={sectionHeadingIds.identity} title={t("sections.identity.title")} description={t("sections.identity.description")}>
              <LogoField name={name} previewUrl={logoUrl} onChange={changeLogo} />
              <BannerPickField previewUrl={bannerUrl} onChange={changeBanner} />

              <div className="space-y-1.5">
                <Label htmlFor="project-name">{t("name.label")}</Label>
                <Input
                  id="project-name"
                  autoComplete="off"
                  maxLength={160}
                  placeholder={t("name.placeholder")}
                  aria-invalid={!!errors.name}
                  aria-describedby={`${ids}-name-note`}
                  {...register("name")}
                />
                {errors.name ? (
                  <p id={`${ids}-name-note`} role="alert" className="text-sm text-destructive">
                    {tv(errors.name.message!)}
                  </p>
                ) : (
                  <p id={`${ids}-name-note`} className="min-h-5 text-sm text-muted-foreground">
                    {slug ? t("name.address", { slug: `${slug}-…` }) : ""}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <Label htmlFor="project-tagline">{t("tagline.label")}</Label>
                  <span className="text-xs text-muted-foreground">{t("tagline.optional")}</span>
                </div>
                <Input
                  id="project-tagline"
                  autoComplete="off"
                  maxLength={TAGLINE_MAX}
                  placeholder={t("tagline.placeholder")}
                  aria-invalid={!!errors.tagline}
                  aria-describedby={`${ids}-tagline-count`}
                  {...register("tagline")}
                />
                <p id={`${ids}-tagline-count`} className="text-right text-xs text-muted-foreground">
                  {t("tagline.counter", { count: taglineLength, max: TAGLINE_MAX })}
                </p>
              </div>
            </Section>

            <Section id={typeLabelId} title={t("sections.type.title")} description={t("sections.type.description")}>
              <Controller
                control={control}
                name="projectType"
                render={({ field }) => (
                  <TypePicker id={`${ids}-type-picker`} value={field.value} onChange={field.onChange} labelledBy={typeLabelId} invalid={!!errors.projectType} />
                )}
              />
              {errors.projectType && (
                <p role="alert" className="text-sm text-destructive">
                  {tv(errors.projectType.message ?? "required")}
                </p>
              )}
            </Section>

            <Section
              id={sectionHeadingIds.technology}
              title={t("sections.technology.title")}
              description={t("sections.technology.description", { max: MAX_TECH_SELECTION })}
            >
              <Controller
                control={control}
                name="techStack"
                render={({ field }) => <TechPicker type={values.projectType} value={field.value} onChange={field.onChange} />}
              />
            </Section>

            <Section id={sectionHeadingIds.planning} title={ts("sections.planning.title")} description={ts("sections.planning.description")}>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="create-status">{ts("status")}</Label>
                  <Controller
                    control={control}
                    name="status"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="create-status" className="w-full">
                          <SelectValue>{(value: (typeof projectStatuses)[number]) => ts(`statusValues.${value}`)}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {projectStatuses.map((status) => (
                            <SelectItem key={status} value={status}>{ts(`statusValues.${status}`)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="create-priority">{ts("priority")}</Label>
                  <Controller
                    control={control}
                    name="priority"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="create-priority" className="w-full">
                          <SelectValue>{(value: (typeof projectPriorities)[number]) => ts(`priorityValues.${value}`)}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {projectPriorities.map((priority) => (
                            <SelectItem key={priority} value={priority}>{ts(`priorityValues.${priority}`)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="create-start">{ts("startDate")}</Label>
                  <Controller
                    control={control}
                    name="startDate"
                    render={({ field }) => (
                      <DatePicker
                        id="create-start"
                        label={ts("startDate")}
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
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="create-end">{ts("targetEndDate")}</Label>
                  <Controller
                    control={control}
                    name="targetEndDate"
                    render={({ field }) => (
                      <DatePicker
                        id="create-end"
                        label={ts("targetEndDate")}
                        value={field.value ?? ""}
                        ref={field.ref}
                        onBlur={field.onBlur}
                        invalid={!!errors.targetEndDate}
                        describedBy={errors.targetEndDate ? "create-end-error" : undefined}
                        onChange={(next) => setValue("targetEndDate", next, { shouldDirty: true, shouldValidate: true })}
                      />
                    )}
                  />
                  {errors.targetEndDate && (
                    <p id="create-end-error" role="alert" className="text-sm text-destructive">
                      {tv(errors.targetEndDate.message!)}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="create-organization">{ts("organization")}</Label>
                  <Controller
                    control={control}
                    name="organizationId"
                    render={({ field }) => (
                      <Select value={field.value ?? "__standalone__"} disabled={!organizations} onValueChange={(next) => setValue("organizationId", next === "__standalone__" ? undefined : next || undefined, { shouldDirty: true })}>
                        <SelectTrigger id="create-organization" className="w-full">
                          <SelectValue placeholder={ts("organizationNone")}>
                            {(value: string) => organizations?.content.find((org) => org.id === value)?.name ?? ts("organizationNone")}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__standalone__">{ts("organizationNone")}</SelectItem>
                          {(organizations?.content ?? []).map((org) => (
                            <SelectItem key={org.id} value={org.id}>
                              {org.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>
            </Section>

            <Section id={sectionHeadingIds.details} title={t("sections.details.title")} description={t("sections.details.description")}>
              <div className="space-y-1.5">
                <Label htmlFor="project-description">{t("details.description")}</Label>
                <Textarea
                  id="project-description"
                  rows={4}
                  placeholder={t("details.descriptionPlaceholder")}
                  aria-invalid={!!errors.description}
                  {...register("description")}
                />
                {errors.description && (
                  <p role="alert" className="text-sm text-destructive">
                    {tv(errors.description.message!)}
                  </p>
                )}
              </div>
            </Section>

            <Section id={taskModelId} title={tm("settingTitle")} description={tm("settingDescription")}>
              <fieldset className="@container min-w-0 space-y-4">
                <legend className="sr-only">{tm("settingTitle")}</legend>
                <Controller
                  control={control}
                  name="taskManagementMode"
                  render={({ field }) => <TaskModelOptions value={field.value} onChange={field.onChange} />}
                />
              </fieldset>
              <p className="text-sm text-muted-foreground">{tm("changeLater")}</p>
            </Section>

            <Section id={sectionHeadingIds.repository} title={t("sections.repository.title")} description={t("sections.repository.description")}>
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <Label htmlFor="project-repository-url">{t("repository.label")}</Label>
                  <span className="text-xs text-muted-foreground">{t("repository.optional")}</span>
                </div>
                <Input
                  id="project-repository-url"
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  maxLength={500}
                  placeholder="https://github.com/owner/repo"
                  value={repositoryUrl}
                  aria-invalid={repositoryUrlInvalid}
                  aria-describedby={`${ids}-repository-note`}
                  onChange={(event) => {
                    setRepositoryUrl(event.target.value);
                    setRepositoryUrlInvalid(false);
                  }}
                />
                {repositoryUrlInvalid ? (
                  <p id={`${ids}-repository-note`} role="alert" className="text-sm text-destructive">
                    {tv("githubUrl")}
                  </p>
                ) : (
                  <p id={`${ids}-repository-note`} className="text-sm text-muted-foreground">
                    {t("repository.hint")}
                  </p>
                )}
              </div>
              {repositoryUrl.trim() !== "" && <RepositoryOptions value={repositorySettings} onChange={setRepositorySettings} />}
            </Section>
          </div>

          <ProjectPreviewPanel
            title={t("preview.title")}
            caption={t("preview.caption")}
            project={previewProject}
            preview={{ logoSrc: logoUrl, bannerSrc: bannerUrl, updatedLabel: t("preview.now") }}
          />
        </div>

        <FormErrorSummary
          key={submitCount}
          id={summaryId}
          title={tfs("projectTitle")}
          description={tfs("description")}
          sectionsLabel={tfs("sectionsLabel")}
          sections={summarySections}
        />

        <StickyFormActions className={summarySections.length > 0 ? "mt-4" : undefined}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link href="/projects" className={buttonVariants({ variant: "outline" })}>
              {t("actions.cancel")}
            </Link>
            <div className="ml-auto flex items-center gap-2">
              <a href="#project-preview" className={buttonVariants({ variant: "ghost", className: "lg:hidden" })}>
                <Eye size={16} data-icon="inline-start" aria-hidden="true" />
                <span className="sr-only min-[440px]:not-sr-only">{t("preview.show")}</span>
              </a>
              <Button type="submit" disabled={mutation.isPending} aria-describedby={summarySections.length > 0 ? summaryId : undefined}>
                {mutation.isPending && <CircleNotch size={16} className="animate-spin" aria-hidden="true" />}
                {t("actions.submit")}
              </Button>
            </div>
          </div>
        </StickyFormActions>
      </form>

      <Dialog open={teamPromptSlug !== null} onOpenChange={(open) => { if (!open && teamPromptSlug) router.push(`/projects/${teamPromptSlug}`); }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t("teamPrompt.title")}</DialogTitle>
            <DialogDescription>{t("teamPrompt.description")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => router.push(`/projects/${teamPromptSlug}`)}>
              {t("teamPrompt.no")}
            </Button>
            <Button type="button" onClick={() => router.push(`/projects/${teamPromptSlug}/teams/new`)}>
              {t("teamPrompt.yes")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

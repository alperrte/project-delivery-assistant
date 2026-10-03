"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleNotch, Eye } from "@phosphor-icons/react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/features/auth/hooks/use-session";
import { organizationsApi } from "@/features/organizations/api";
import { errorKey } from "@/lib/api/error-message";
import { projectsApi } from "../api";
import { createProjectSchema, TAGLINE_MAX, type CreateProjectValues } from "../schemas";
import { MAX_TECH_SELECTION } from "../tech-catalog";
import { formatTechStack } from "../tech-stack";
import type { UserRef } from "../types";
import { BannerPickField } from "./create/banner-pick-field";
import { LogoField } from "./create/logo-field";
import { TechPicker } from "./create/tech-picker";
import { TypePicker } from "./create/type-picker";
import { ProjectCard, type ProjectCardData } from "./project-card";

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

/**
 * A picked image file and a local URL to show it with. The URL is created on pick and released when the file is
 * replaced, removed or the page is left.
 */
function usePickedImage() {
  const [picked, setPicked] = useState<{ file: File; url: string } | null>(null);
  const urlRef = useRef<string | null>(null);
  function change(file: File | null) {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = file ? URL.createObjectURL(file) : null;
    setPicked(file && urlRef.current ? { file, url: urlRef.current } : null);
  }
  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );
  return { file: picked?.file ?? null, url: picked?.url ?? null, change };
}

export function ProjectCreatePage({ presentationValues }: { presentationValues?: CreateProjectValues } = {}) {
  const t = useTranslations("projects.newPage");
  const tv = useTranslations("validation");
  const te = useTranslations("errors");
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: user } = useSession();
  const ids = useId();

  const { file: logoFile, url: logoUrl, change: changeLogo } = usePickedImage();
  const { file: bannerFile, url: bannerUrl, change: changeBanner } = usePickedImage();

  const { data: organizations } = useQuery({
    queryKey: ["organizations", "picker"],
    queryFn: () => organizationsApi.list(0, 100),
  });

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isDirty },
  } = useForm<CreateProjectValues>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: { name: "", tagline: "", techStack: [], description: "" },
    values: presentationValues,
  });

  const values = useWatch({ control });
  const dirty = isDirty || logoFile !== null || bannerFile !== null;

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
      return { project, logoFailed, bannerFailed };
    },
    onSuccess: ({ project, logoFailed, bannerFailed }) => {
      created.current = true;
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success(t("actions.created"));
      if (logoFailed) toast.warning(t("actions.logoFailed"));
      if (bannerFailed) toast.warning(t("actions.bannerFailed"));
      router.push(`/projects/${project.slug}`);
    },
    onError: (err) => toast.error(te(errorKey(err))),
  });

  const created = useRef(false);
  const leaving = dirty && !mutation.isPending && !mutation.isSuccess;
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
      status: "PLANNING",
      projectType: values.projectType ?? null,
      techStack: formatTechStack((values.techStack ?? []).filter((item): item is string => typeof item === "string")) || null,
      logoVersion: null,
      team: { memberCount: 1, preview: [author] },
      updatedBy: author,
      updatedAt: new Date().toISOString(),
    }),
    // `author` is derived from the session; keying on its fields keeps the memo stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [name, values.tagline, values.description, values.projectType, values.techStack, author.userId, author.nickname, t],
  );

  const taglineLength = values.tagline?.length ?? 0;
  const typeLabelId = `${ids}-type`;

  return (
    <div>
      <PageHeader title={t("title")} description={t("description")} />

      <form onSubmit={handleSubmit((form) => mutation.mutate(form))} noValidate>
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="space-y-8 lg:col-span-7">
            <Section id={`${ids}-identity`} title={t("sections.identity.title")} description={t("sections.identity.description")}>
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
                  <TypePicker value={field.value} onChange={field.onChange} labelledBy={typeLabelId} invalid={!!errors.projectType} />
                )}
              />
              {errors.projectType && (
                <p role="alert" className="text-sm text-destructive">
                  {tv(errors.projectType.message ?? "required")}
                </p>
              )}
            </Section>

            <Section
              id={`${ids}-technology`}
              title={t("sections.technology.title")}
              description={t("sections.technology.description", { max: MAX_TECH_SELECTION })}
            >
              <Controller
                control={control}
                name="techStack"
                render={({ field }) => <TechPicker type={values.projectType} value={field.value} onChange={field.onChange} />}
              />
            </Section>

            <Section id={`${ids}-details`} title={t("sections.details.title")} description={t("sections.details.description")}>
              {organizations && organizations.content.length > 0 && (
                <div className="space-y-1.5">
                  <Label>{t("details.organization")}</Label>
                  <Controller
                    control={control}
                    name="organizationId"
                    render={({ field }) => (
                      <Select value={field.value ?? ""} onValueChange={(next) => setValue("organizationId", next || undefined, { shouldDirty: true })}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t("details.organizationNone")}>
                            {(value: string) => organizations.content.find((org) => org.id === value)?.name ?? t("details.organizationNone")}
                          </SelectValue>
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
          </div>

          <aside id="project-preview" aria-label={t("preview.title")} className="scroll-mt-24 lg:col-span-5">
            <div className="space-y-3 lg:sticky lg:top-24">
              <div className="space-y-0.5">
                <h2 className="font-heading text-base font-semibold text-foreground">{t("preview.title")}</h2>
                <p className="text-sm text-muted-foreground">{t("preview.caption")}</p>
              </div>
              <div className="mx-auto max-w-sm lg:max-w-none">
                <ProjectCard project={previewProject} preview={{ logoSrc: logoUrl, bannerSrc: bannerUrl, updatedLabel: t("preview.now") }} />
              </div>
            </div>
          </aside>
        </div>

        <div data-sticky-actions className="sticky bottom-0 z-20 -mx-4 -mb-6 mt-10 sm:-mb-8 border-t bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:-mx-8 sm:px-8">
          <div className="flex items-center justify-between gap-2">
            <Link href="/projects" className={buttonVariants({ variant: "outline" })}>
              {t("actions.cancel")}
            </Link>
            <div className="flex items-center gap-2">
              <a href="#project-preview" className={buttonVariants({ variant: "ghost", className: "lg:hidden" })}>
                <Eye size={16} data-icon="inline-start" aria-hidden="true" />
                <span className="sr-only min-[440px]:not-sr-only">{t("preview.show")}</span>
              </a>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <CircleNotch size={16} className="animate-spin" aria-hidden="true" />}
                {t("actions.submit")}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";
import Link from "@/i18n/navigation";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleNotch } from "@phosphor-icons/react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { PageContainer } from "@/components/common/page-container";
import { StickyFormActions } from "@/components/common/sticky-form-actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { PageFailure } from "@/features/errors/page-failure";
import { ProjectGate, type ProjectGateContext } from "@/features/tasks/components/project-gate";
import { errorKey } from "@/lib/api/error-message";
import { criteriaApi } from "../api";
import { CRITERION_DESCRIPTION_MAX, CRITERION_TITLE_MAX, criterionFormSchema, type CriterionFormValues } from "../schemas";
import type { Criterion } from "../types";

function Unavailable({ slug, message }: { slug: string; message: string }) {
  const t = useTranslations("criteria.form");
  return (
    <div className="space-y-4">
      <p role="alert" className="text-sm text-destructive">{message}</p>
      <Link href={`/projects/${slug}/criteria`} className={buttonVariants({ variant: "outline" })}>
        {t("back")}
      </Link>
    </div>
  );
}

function CriterionFormBody({ slug, projectId, criterion }: { slug: string; projectId: string; criterion?: Criterion }) {
  const t = useTranslations("criteria.form");
  const tv = useTranslations("validation");
  const te = useTranslations("errors");
  const router = useRouter();
  const queryClient = useQueryClient();
  const editing = !!criterion;

  // Single section, so there is no validation summary to link to: the inline errors stay and react-hook-form's default
  // `shouldFocusError` moves focus to the first invalid field (title, then description), matching the team standard.
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isDirty },
  } = useForm<CriterionFormValues>({
    resolver: zodResolver(criterionFormSchema),
    mode: "onBlur",
    defaultValues: { title: criterion?.title ?? "", description: criterion?.description ?? "" },
  });
  const titleLength = useWatch({ control, name: "title" })?.length ?? 0;
  const descriptionLength = useWatch({ control, name: "description" })?.length ?? 0;

  const listHref = `/projects/${slug}/criteria`;

  const saved = useRef(false);
  const mutation = useMutation({
    mutationFn: (values: CriterionFormValues) =>
      criterion ? criteriaApi.update(projectId, criterion.id, values) : criteriaApi.create(projectId, values),
    onSuccess: async () => {
      // Flips synchronously, before React re-renders, so navigating right after saving never warns.
      saved.current = true;
      // The overview's criteria progress comes from the project home, so it is refreshed together with the list.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["projects", projectId, "criteria"] }),
        queryClient.invalidateQueries({ queryKey: ["projects", projectId, "home"] }),
      ]);
      toast.success(editing ? t("updated") : t("created"));
      router.push(listHref);
    },
    onError: (err) => toast.error(te(errorKey(err))),
  });

  const leaving = isDirty && !mutation.isPending && !mutation.isSuccess;
  useEffect(() => {
    if (!leaving) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (!saved.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [leaving]);

  return (
    <div>
      <PageHeader title={t(editing ? "editTitle" : "createTitle")} description={t(editing ? "editDescription" : "description")} />

      <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
        <PageContainer width="form">
          <div className="max-w-2xl space-y-6">
            <div className="space-y-1.5">
              <Label htmlFor="criterion-title">{t("titleLabel")}</Label>
              <Input
                id="criterion-title"
                autoComplete="off"
                autoFocus={!editing}
                maxLength={CRITERION_TITLE_MAX}
                aria-invalid={!!errors.title}
                aria-describedby={`criterion-title-${errors.title ? "error" : "count"}`}
                {...register("title")}
              />
              {errors.title ? (
                <p id="criterion-title-error" role="alert" className="text-sm text-destructive">
                  {tv(errors.title.message!, { max: CRITERION_TITLE_MAX })}
                </p>
              ) : (
                <p id="criterion-title-count" className="text-right text-xs text-muted-foreground tabular-nums">
                  {titleLength}/{CRITERION_TITLE_MAX}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <Label htmlFor="criterion-description">{t("descriptionLabel")}</Label>
                <span className="text-xs text-muted-foreground">{t("optional")}</span>
              </div>
              <Textarea
                id="criterion-description"
                rows={4}
                maxLength={CRITERION_DESCRIPTION_MAX}
                aria-invalid={!!errors.description}
                aria-describedby={`criterion-description-${errors.description ? "error" : "count"}`}
                {...register("description")}
              />
              {errors.description ? (
                <p id="criterion-description-error" role="alert" className="text-sm text-destructive">
                  {tv(errors.description.message!, { max: CRITERION_DESCRIPTION_MAX })}
                </p>
              ) : (
                <p id="criterion-description-count" className="text-right text-xs text-muted-foreground tabular-nums">
                  {descriptionLength}/{CRITERION_DESCRIPTION_MAX}
                </p>
              )}
            </div>
          </div>
        </PageContainer>

        <StickyFormActions>
          <div className="flex items-center justify-between gap-2">
            <Link href={listHref} className={buttonVariants({ variant: "outline" })}>
              {t("cancel")}
            </Link>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <CircleNotch size={16} className="animate-spin" aria-hidden="true" />}
              {editing ? t("save") : t("create")}
            </Button>
          </div>
        </StickyFormActions>
      </form>
    </div>
  );
}

/** Edit loads the criterion from the project's criteria list (there is no single-criterion endpoint). */
function CriterionFormView({ slug, projectId, isManager, criterionId }: ProjectGateContext & { criterionId?: string }) {
  const te = useTranslations("errors");
  const editing = criterionId !== undefined;
  const criteria = useQuery({
    queryKey: ["projects", projectId, "criteria"],
    queryFn: () => criteriaApi.list(projectId),
    enabled: editing && isManager,
  });

  // The server stays the authority (CRITERIA_MANAGE); this only avoids offering a form that would be refused.
  if (!isManager) return <Unavailable slug={slug} message={te("forbidden")} />;
  if (editing && criteria.isPending) {
    return (
      <div className="space-y-5" aria-hidden="true">
        <Skeleton className="h-16 w-2/3 rounded-xl" />
        <Skeleton className="h-64 w-full max-w-2xl rounded-xl" />
      </div>
    );
  }
  if (editing && criteria.error) return <PageFailure error={criteria.error} onRetry={() => { void criteria.refetch(); }} />;
  const criterion = editing ? criteria.data?.find((item) => item.id === criterionId) : undefined;
  if (editing && !criterion) return <Unavailable slug={slug} message={te("notFound")} />;

  return <CriterionFormBody key={criterion?.id ?? "new"} slug={slug} projectId={projectId} criterion={criterion} />;
}

/** Create (`criterionId` omitted) and edit share one full-page form. */
export function CriterionFormPage({ slug, criterionId }: { slug: string; criterionId?: string }) {
  return <ProjectGate slug={slug}>{(context) => <CriterionFormView {...context} criterionId={criterionId} />}</ProjectGate>;
}

"use client";

import { useEffect, type ReactNode } from "react";
import Link from "@/i18n/navigation";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleNotch } from "@phosphor-icons/react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { PageContainer } from "@/components/common/page-container";
import { StickyFormActions } from "@/components/common/sticky-form-actions";
import { BreadcrumbLabel } from "@/components/layout/breadcrumb-labels";
import { Button, buttonVariants } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { PageFailure } from "@/features/errors/page-failure";
import { todayKey } from "@/features/reminders/dates";
import { ProjectGate, type ProjectGateContext } from "@/features/tasks/components/project-gate";
import { AdvancedReadOnlyNotice } from "@/features/tasks/components/task-mode-picker";
import { useTaskMutation } from "@/features/tasks/hooks";
import { allowsAdvanced } from "@/features/tasks/task-model";
import { sprintsApi } from "../api";
import { addDays } from "../dates";
import { useSprint } from "../hooks";
import { SPRINT_GOAL_MAX, SPRINT_NAME_MAX, sprintFormSchema, toSprintPayload, type SprintFormValues } from "../schemas";
import type { Sprint } from "../types";

const DEFAULT_LENGTH_DAYS = 13;

function Unavailable({ slug, children }: { slug: string; children: ReactNode }) {
  const t = useTranslations("sprints.dialog");
  return (
    <div className="space-y-4">
      {children}
      <Link href={`/projects/${slug}/sprints`} className={buttonVariants({ variant: "outline" })}>
        {t("back")}
      </Link>
    </div>
  );
}

function SprintFormBody({ slug, projectId, sprint }: { slug: string; projectId: string; sprint?: Sprint }) {
  const t = useTranslations("sprints.dialog");
  const tv = useTranslations("validation");
  const router = useRouter();
  const editing = !!sprint;
  const today = todayKey();

  // Name and goal sit above the dates and every field is visible without scrolling, so there is no section summary to
  // link to: inline errors stay and react-hook-form's default `shouldFocusError` focuses the first invalid field in page
  // order (name, goal, start, end; the date pickers forward the field ref), matching the team standard.
  const {
    register,
    handleSubmit,
    control,
    trigger,
    getValues,
    formState: { errors, isDirty },
  } = useForm<SprintFormValues>({
    resolver: zodResolver(sprintFormSchema),
    defaultValues: {
      name: sprint?.name ?? "",
      goal: sprint?.goal ?? "",
      startDate: sprint?.startDate ?? today,
      endDate: sprint?.endDate ?? addDays(today, DEFAULT_LENGTH_DAYS),
    },
  });

  const listHref = `/projects/${slug}/sprints`;
  // Editing returns to the sprint it was opened for (the list and the detail page both offer the edit link).
  const backHref = sprint ? `${listHref}/${sprint.id}` : listHref;

  const save = useTaskMutation(
    projectId,
    (values: SprintFormValues) => {
      const body = toSprintPayload(values);
      return sprint ? sprintsApi.update(projectId, sprint.id, body) : sprintsApi.create(projectId, body);
    },
    {
      onSuccess: (saved) => {
        toast.success(t(editing ? "updated" : "created", { name: saved.name }));
        router.push(backHref);
      },
    },
  );

  const goalLength = useWatch({ control, name: "goal" }).length;
  const startDate = useWatch({ control, name: "startDate" });

  const leaving = isDirty && !save.isPending && !save.isSuccess;
  useEffect(() => {
    if (!leaving) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [leaving]);

  return (
    <div>
      {sprint && <BreadcrumbLabel kind="sprint" label={sprint.name} />}
      <PageHeader title={t(editing ? "editTitle" : "createTitle")} description={t("description")} />

      <form onSubmit={handleSubmit((values) => save.mutate(values))} noValidate>
        <PageContainer width="form">
          <div className="max-w-2xl space-y-6">
            <div className="space-y-1.5">
              <Label htmlFor="sprint-name">{t("name")}</Label>
              <Input
                id="sprint-name"
                maxLength={SPRINT_NAME_MAX}
                autoFocus={!editing}
                autoComplete="off"
                placeholder={t("namePlaceholder")}
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? "sprint-name-error" : undefined}
                {...register("name")}
              />
              {errors.name && (
                <p id="sprint-name-error" role="alert" className="text-sm text-destructive">
                  {tv(errors.name.message!, { max: SPRINT_NAME_MAX })}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <Label htmlFor="sprint-goal">{t("goal")}</Label>
                <span className="text-xs text-muted-foreground">{t("optional")}</span>
              </div>
              <Textarea
                id="sprint-goal"
                rows={4}
                maxLength={SPRINT_GOAL_MAX}
                placeholder={t("goalPlaceholder")}
                aria-invalid={!!errors.goal}
                aria-describedby={errors.goal ? "sprint-goal-error" : undefined}
                {...register("goal")}
              />
              <div className="flex items-start justify-between gap-3">
                {errors.goal ? (
                  <p id="sprint-goal-error" role="alert" className="text-sm text-destructive">
                    {tv(errors.goal.message!, { max: SPRINT_GOAL_MAX })}
                  </p>
                ) : (
                  <span />
                )}
                <span className="text-xs text-muted-foreground tabular-nums">
                  {goalLength}/{SPRINT_GOAL_MAX}
                </span>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="sprint-start">{t("startDate")}</Label>
                <Controller
                  control={control}
                  name="startDate"
                  render={({ field }) => (
                    <DatePicker
                      id="sprint-start"
                      label={t("startDate")}
                      value={field.value}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      onChange={(next) => {
                        field.onChange(next);
                        if (errors.startDate) void trigger("startDate");
                        if (getValues("endDate")) void trigger("endDate");
                      }}
                      invalid={!!errors.startDate}
                      describedBy={errors.startDate ? "sprint-start-error" : undefined}
                    />
                  )}
                />
                {errors.startDate && (
                  <p id="sprint-start-error" role="alert" className="text-sm text-destructive">
                    {tv(errors.startDate.message!)}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sprint-end">{t("endDate")}</Label>
                <Controller
                  control={control}
                  name="endDate"
                  render={({ field }) => (
                    <DatePicker
                      id="sprint-end"
                      label={t("endDate")}
                      value={field.value}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      onChange={(next) => {
                        field.onChange(next);
                        if (errors.endDate) void trigger("endDate");
                      }}
                      invalid={!!errors.endDate}
                      describedBy={errors.endDate ? "sprint-end-error" : undefined}
                      min={startDate || undefined}
                    />
                  )}
                />
                {errors.endDate && (
                  <p id="sprint-end-error" role="alert" className="text-sm text-destructive">
                    {tv(errors.endDate.message!)}
                  </p>
                )}
              </div>
            </div>
          </div>
        </PageContainer>

        <StickyFormActions>
          <div className="flex items-center justify-between gap-2">
            <Link href={backHref} className={buttonVariants({ variant: "outline" })}>
              {t("cancel")}
            </Link>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <CircleNotch size={16} className="animate-spin" aria-hidden="true" />}
              {editing ? t("save") : t("create")}
            </Button>
          </div>
        </StickyFormActions>
      </form>
    </div>
  );
}

function SprintFormView({ slug, projectId, project, isManager, sprintId }: ProjectGateContext & { sprintId?: string }) {
  const te = useTranslations("errors");
  const editing = sprintId !== undefined;
  const writable = isManager && allowsAdvanced(project.taskManagementMode);
  const sprint = useSprint(projectId, editing && writable ? sprintId : "");

  // The server stays the authority; this only avoids offering a form that would be refused.
  if (!isManager) {
    return (
      <Unavailable slug={slug}>
        <p role="alert" className="text-sm text-destructive">{te("forbidden")}</p>
      </Unavailable>
    );
  }
  if (!allowsAdvanced(project.taskManagementMode)) {
    return (
      <Unavailable slug={slug}>
        <AdvancedReadOnlyNotice />
      </Unavailable>
    );
  }
  if (editing && sprint.isPending) {
    return (
      <div className="space-y-5" aria-hidden="true">
        <Skeleton className="h-16 w-2/3 rounded-xl" />
        <Skeleton className="h-80 w-full max-w-2xl rounded-xl" />
      </div>
    );
  }
  if (editing && sprint.error) return <PageFailure error={sprint.error} onRetry={() => { void sprint.refetch(); }} />;
  // A finished sprint is history: the list and the detail page never offer its edit link.
  if (editing && (!sprint.data || sprint.data.status === "COMPLETED")) {
    return (
      <Unavailable slug={slug}>
        <p role="alert" className="text-sm text-destructive">{te(sprint.data ? "forbidden" : "notFound")}</p>
      </Unavailable>
    );
  }

  return <SprintFormBody key={sprint.data?.id ?? "new"} slug={slug} projectId={projectId} sprint={sprint.data} />;
}

/** Create (`sprintId` omitted) and edit share one full-page form. */
export function SprintFormPage({ slug, sprintId }: { slug: string; sprintId?: string }) {
  return <ProjectGate slug={slug}>{(context) => <SprintFormView {...context} sprintId={sprintId} />}</ProjectGate>;
}

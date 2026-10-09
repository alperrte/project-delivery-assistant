"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "@/i18n/navigation";
import { useRouter, useSearchParams } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CircleNotch, Eye } from "@phosphor-icons/react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { BreadcrumbLabel } from "@/components/layout/breadcrumb-labels";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useSprints } from "@/features/sprints/hooks";
import { ApiError } from "@/lib/api/client";
import { TaskModelSetting } from "@/features/projects/components/task-model-setting";
import { allowsAdvanced, allowsCreation, initialCreationMode } from "../task-model";
import { AdvancedReadOnlyNotice, TaskModePicker } from "./task-mode-picker";
import { errorKey } from "@/lib/api/error-message";
import { tasksApi } from "../api";
import { fromDeadlineIso, quickDeadline, splitMinutes, type QuickDeadline } from "../deadline";
import { invalidateTaskViews, useTask } from "../hooks";
import {
  CHECKLIST_MAX,
  CHECKLIST_TEXT_MAX,
  emptyTaskForm,
  estimateMinutes,
  TASK_ASSIGNEES_MAX,
  TASK_DESCRIPTION_MAX,
  TASK_LABELS_MAX,
  TASK_TITLE_MAX,
  taskFormSchema,
  toTaskPayload,
  type TaskFormValues,
} from "../schemas";
import { useProjectTeams } from "../hooks";
import { ESTIMATE_POINTS, TASK_PRIORITIES, type PersonRef, type Task, type TaskPriority, type TaskRef } from "../types";
import { PriorityIndicator } from "./task-badges";
import { AssigneePicker, FormSection, LabelPicker, ParentPicker, Segment } from "./task-form-fields";
import { TaskPreview } from "./task-preview";
import { ProjectGate, type ProjectGateContext } from "./project-gate";

const NO_SPRINT = "__none";
const WHOLE_PROJECT = "__project";
const QUICK: QuickDeadline[] = ["today", "tomorrow", "weekEnd", "nextWeek"];

function initialValues(task: Task | undefined, sprintId: string, parentId: string): TaskFormValues {
  if (!task) return { ...emptyTaskForm, sprintId, parentTaskId: parentId };
  const deadline = fromDeadlineIso(task.deadlineAt);
  const time = task.timeEstimateMinutes === null ? null : splitMinutes(task.timeEstimateMinutes);
  return {
    creationMode: task.creationMode,
    title: task.title,
    description: task.description ?? "",
    priority: task.priority,
    estimatePoints: task.estimatePoints,
    estimateHours: time && time.hours > 0 ? String(time.hours) : "",
    estimateMinutes: time && time.minutes > 0 ? String(time.minutes) : "",
    startDate: task.startDate ?? "",
    deadlineDate: deadline.date,
    deadlineTime: deadline.time,
    sprintId: task.sprint?.id ?? "",
    labelIds: task.labels.map((label) => label.id),
    parentTaskId: task.parent?.id ?? "",
    assignMode: task.pool?.open ? "pool" : "people",
    assigneeIds: task.assigneeIds,
    poolTeamId: task.pool?.teamId ?? "",
    checklist: [],
  };
}

type BodyProps = ProjectGateContext & {
  task?: Task;
  initialSprintId: string;
  initialParent: TaskRef | null;
  presentationValues?: TaskFormValues;
};

export function TaskFormBody({ slug, project, projectId, userId, task, initialSprintId, initialParent, presentationValues }: BodyProps) {
  const t = useTranslations("tasks.form");
  const tc = useTranslations("tasks.common");
  const tm = useTranslations("taskModels");
  const tv = useTranslations("validation");
  const te = useTranslations("errors");
  const router = useRouter();
  const queryClient = useQueryClient();
  const ids = useId();
  const editing = !!task;

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isDirty },
  } = useForm<TaskFormValues>({
    resolver: async (form, context, options) => {
      const result = await zodResolver(taskFormSchema)(
        form.creationMode === "ADVANCED" && !allowsAdvanced(project.taskManagementMode) ? { ...form, creationMode: "SIMPLE" } : form,
        context,
        options,
      );
      if (Object.keys(result.errors).length) return { values: {}, errors: result.errors };
      return { errors: {}, values: { ...result.values, creationMode: form.creationMode } as TaskFormValues };
    },
    defaultValues: { ...initialValues(task, initialSprintId, initialParent?.id ?? ""), creationMode: task?.creationMode ?? initialCreationMode(project.taskManagementMode, !!initialParent || !!initialSprintId) },
    values: presentationValues,
  });
  const values = useWatch({ control });
  const mode = values.creationMode ?? "SIMPLE";
  const advancedWritable = allowsAdvanced(project.taskManagementMode);
  const advanced = mode === "ADVANCED" && advancedWritable;
  const sprints = useSprints(projectId, undefined, advanced);
  const teams = useProjectTeams(projectId);
  const canSave = !task?.archivedAt && (editing ? mode === task.creationMode || allowsCreation(project.taskManagementMode, mode) : allowsCreation(project.taskManagementMode, mode));

  const [parent, setParent] = useState<TaskRef | null>(task?.parent ?? initialParent);
  const [checklistText, setChecklistText] = useState("");
  const [previewDescription, setPreviewDescription] = useState(false);

  function pickParent(next: TaskRef | null) {
    setParent(next);
    setValue("parentTaskId", next?.id ?? "", { shouldDirty: true });
  }

  function editChecklist(text: string) {
    setChecklistText(text);
    const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
    setValue("checklist", lines, { shouldDirty: true, shouldValidate: true });
  }

  const backHref = editing ? `/projects/${slug}/tasks/${task.id}` : `/projects/${slug}/tasks`;

  const created = useRef(false);
  const mutation = useMutation({
    mutationFn: async (form: TaskFormValues) => {
      const payload = toTaskPayload(form, task, advancedWritable);
      if (task) return { saved: await tasksApi.update(projectId, task.id, payload), checklistFailed: 0 };
      const saved = await tasksApi.create(projectId, payload);
      let checklistFailed = 0;
      for (const text of form.creationMode === "ADVANCED" ? form.checklist : []) {
        try {
          await tasksApi.addChecklistItem(projectId, saved.id, text);
        } catch {
          checklistFailed += 1;
        }
      }
      return { saved, checklistFailed };
    },
    onSuccess: async ({ saved, checklistFailed }) => {
      created.current = true;
      await invalidateTaskViews(queryClient, projectId);
      toast.success(t(editing ? "saved" : "created", { key: saved.taskKey }));
      if (checklistFailed > 0) toast.error(t("checklist.partial", { count: checklistFailed }));
      router.push(`/projects/${slug}/tasks/${saved.id}`);
    },
    onError: (err) => {
      if (err instanceof ApiError && (err.code === "TASK_MODE_NOT_ALLOWED" || err.code === "PROJECT_TASK_MODE_NOT_CONFIGURED")) void queryClient.invalidateQueries({ queryKey: ["projects", "by-slug"] });
      toast.error(te(errorKey(err)));
    },
  });

  const leaving = isDirty && !mutation.isPending && !mutation.isSuccess;
  useEffect(() => {
    if (!leaving) return;
    // `created` flips synchronously, before React re-renders, so navigating right after saving never warns.
    const warn = (event: BeforeUnloadEvent) => {
      if (!created.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [leaving]);

  const priority = (values.priority ?? "MEDIUM") as TaskPriority;
  const titleLength = values.title?.length ?? 0;
  const descriptionText = values.description ?? "";
  const inPool = values.assignMode === "pool";
  const lockedParent = editing && (task?.subtaskCount ?? 0) > 0;
  const sprintOptions = (sprints.data ?? []).filter((sprint) => sprint.status !== "COMPLETED" || sprint.id === values.sprintId);

  const known: PersonRef[] = task?.assignees ?? [];
  const totalMinutes = estimateMinutes(values.estimateHours ?? "", values.estimateMinutes ?? "");

  function applyQuick(kind: QuickDeadline) {
    const next = quickDeadline(kind);
    setValue("deadlineDate", next.date, { shouldDirty: true, shouldValidate: true });
    // Simple tasks hide the time field; quick picks use the same end-of-day semantics.
    setValue("deadlineTime", advanced ? next.time : "", { shouldDirty: true });
  }

  return (
    <div>
      {editing && task && <BreadcrumbLabel kind="task" label={task.taskKey} />}
      <PageHeader title={t(editing ? "editTitle" : "title")} description={t(editing ? "editDescription" : "description")} />

      <TaskModePicker value={mode} policy={project.taskManagementMode} userId={userId} onChange={(next) => setValue("creationMode", next, { shouldDirty: true, shouldValidate: true })} />
      {mode === "ADVANCED" && !advancedWritable && <AdvancedReadOnlyNotice />}
      <form onSubmit={handleSubmit((form) => { if (canSave) mutation.mutate(form); })} noValidate>
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="min-w-0 space-y-8 lg:col-span-7">
            <FormSection id={`${ids}-definition`} title={t("sections.definition.title")} description={t("sections.definition.description")}>
              <div className="space-y-1.5">
                <Label htmlFor="task-title">{t("titleField.label")}</Label>
                <Input
                  id="task-title"
                  autoComplete="off"
                  autoFocus={!editing && !presentationValues}
                  maxLength={TASK_TITLE_MAX}
                  placeholder={t("titleField.placeholder")}
                  aria-invalid={!!errors.title}
                  aria-describedby={`${ids}-title-note`}
                  {...register("title")}
                />
                {errors.title ? (
                  <p id={`${ids}-title-note`} role="alert" className="text-sm text-destructive">
                    {tv(errors.title.message!, { max: TASK_TITLE_MAX })}
                  </p>
                ) : (
                  <p id={`${ids}-title-note`} className="text-right text-xs text-muted-foreground">
                    {t("counter", { count: titleLength, max: TASK_TITLE_MAX })}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="task-description">{t("descriptionField.label")}</Label>
                  <div className="flex items-center gap-1" role="group" aria-label={t("descriptionField.mode")}>
                    <Button type="button" variant={previewDescription ? "ghost" : "secondary"} size="sm" aria-pressed={!previewDescription} onClick={() => setPreviewDescription(false)}>
                      {t("descriptionField.write")}
                    </Button>
                    <Button type="button" variant={previewDescription ? "secondary" : "ghost"} size="sm" aria-pressed={previewDescription} onClick={() => setPreviewDescription(true)}>
                      {t("descriptionField.preview")}
                    </Button>
                  </div>
                </div>
                {previewDescription ? (
                  <div className="min-h-32 rounded-lg border bg-card px-3 py-2 text-sm leading-6 whitespace-pre-wrap text-foreground">
                    {descriptionText.trim() || <span className="text-muted-foreground">{t("descriptionField.previewEmpty")}</span>}
                  </div>
                ) : (
                  <Textarea
                    id="task-description"
                    rows={6}
                    maxLength={TASK_DESCRIPTION_MAX}
                    placeholder={t("descriptionField.placeholder")}
                    aria-invalid={!!errors.description}
                    aria-describedby={`${ids}-description-note`}
                    {...register("description")}
                  />
                )}
                {errors.description ? (
                  <p id={`${ids}-description-note`} role="alert" className="text-sm text-destructive">
                    {tv(errors.description.message!, { max: TASK_DESCRIPTION_MAX })}
                  </p>
                ) : (
                  <p id={`${ids}-description-note`} className="text-right text-xs text-muted-foreground">
                    {t("counter", { count: descriptionText.length, max: TASK_DESCRIPTION_MAX })}
                  </p>
                )}
              </div>

              {advanced && (
                <>
                  <div className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <Label>{t("parent.label")}</Label>
                      <span className="text-xs text-muted-foreground">{t("optional")}</span>
                    </div>
                    <ParentPicker projectId={projectId} value={parent} onChange={pickParent} excludeId={task?.id} disabled={lockedParent} />
                    <p className="text-sm text-muted-foreground">{lockedParent ? t("parent.locked") : t("parent.hint")}</p>
                  </div>
                </>
              )}
            </FormSection>

            <FormSection id={`${ids}-planning`} title={t("sections.planning.title")} description={advanced ? t("sections.planning.description") : tm("simplePlanning")}>
              <div className="space-y-1.5">
                <Label>{t("priority.label")}</Label>
                <Controller
                  control={control}
                  name="priority"
                  render={({ field }) => (
                    <Segment
                      label={t("priority.label")}
                      value={field.value}
                      onChange={(next) => setValue("priority", next as TaskPriority, { shouldDirty: true })}
                      options={TASK_PRIORITIES.map((item) => ({
                        value: item,
                        label: tc(`priority.${item}`),
                        adornment: <PriorityIndicator priority={item} />,
                      }))}
                    />
                  )}
                />
              </div>

              {advanced && (
                <>
                  <div className="space-y-1.5">
                    <Label>{t("points.label")}</Label>
                    <Controller
                      control={control}
                      name="estimatePoints"
                      render={({ field }) => (
                        <Segment
                          label={t("points.label")}
                          value={field.value === null ? "" : String(field.value)}
                          onChange={(next) => setValue("estimatePoints", next === "" ? null : Number(next), { shouldDirty: true })}
                          options={[{ value: "", label: t("points.none") }, ...ESTIMATE_POINTS.map((points) => ({ value: String(points), label: String(points) }))]}
                        />
                      )}
                    />
                    <p className="text-sm text-muted-foreground">{t("points.hint")}</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="task-estimate-hours">{t("time.label")}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="task-estimate-hours"
                        inputMode="numeric"
                        maxLength={5}
                        placeholder="0"
                        aria-label={t("time.hours")}
                        aria-invalid={!!errors.estimateHours}
                        className="w-24"
                        {...register("estimateHours")}
                      />
                      <span className="text-sm text-muted-foreground">{t("time.hoursUnit")}</span>
                      <Input
                        inputMode="numeric"
                        maxLength={5}
                        placeholder="0"
                        aria-label={t("time.minutes")}
                        aria-invalid={!!errors.estimateMinutes}
                        className="w-24"
                        {...register("estimateMinutes")}
                      />
                      <span className="text-sm text-muted-foreground">{t("time.minutesUnit")}</span>
                    </div>
                    {errors.estimateHours || errors.estimateMinutes ? (
                      <p role="alert" className="text-sm text-destructive">
                        {tv((errors.estimateHours ?? errors.estimateMinutes)!.message!)}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">{totalMinutes === null ? t("time.hint") : t("time.total", { minutes: totalMinutes })}</p>
                    )}
                  </div>

                </>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="min-w-0 space-y-1.5">
                  <Label htmlFor="task-start">{t("start.label")}</Label>
                  <Controller control={control} name="startDate" render={({ field }) => (
                    <DatePicker id="task-start" label={t("start.label")} value={field.value} ref={field.ref} onBlur={field.onBlur}
                      invalid={!!errors.startDate} onChange={next => setValue("startDate", next, { shouldDirty: true, shouldValidate: true })} />
                  )} />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <Label htmlFor="task-deadline-date">{t("deadline.label")}</Label>
                  <div className="flex gap-2">
                    <Controller control={control} name="deadlineDate" render={({ field }) => (
                      <DatePicker id="task-deadline-date" label={t("deadline.label")} value={field.value} ref={field.ref} onBlur={field.onBlur}
                        invalid={!!errors.deadlineDate} describedBy={`${ids}-deadline-note`} onChange={next => {
                          if (!next) setValue("deadlineTime", "", { shouldDirty: true });
                          setValue("deadlineDate", next, { shouldDirty: true, shouldValidate: true });
                        }} />
                    )} />
                    {advanced && <Input type="time" aria-label={t("deadline.time")} className="h-10 w-28 shrink-0" {...register("deadlineTime")} />}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t("deadline.quick")}>
                {QUICK.map((kind) => (
                  <Button key={kind} type="button" variant="outline" size="sm" onClick={() => applyQuick(kind)}>
                    {t(`deadline.${kind}`)}
                  </Button>
                ))}
                {(values.deadlineDate || values.deadlineTime) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setValue("deadlineDate", "", { shouldDirty: true, shouldValidate: true });
                      setValue("deadlineTime", "", { shouldDirty: true });
                    }}
                  >
                    {t("deadline.clear")}
                  </Button>
                )}
              </div>
              {errors.deadlineDate ? (
                <p id={`${ids}-deadline-note`} role="alert" className="text-sm text-destructive">
                  {tv(errors.deadlineDate.message!)}
                </p>
              ) : (
                <p id={`${ids}-deadline-note`} className="text-sm text-muted-foreground">
                  {advanced ? t("deadline.hint") : tm("simpleDeadline")}
                </p>
              )}

              {advanced && (
                <>
                  <div className="space-y-1.5">
                    <Label>{t("sprint.label")}</Label>
                    <Controller
                      control={control}
                      name="sprintId"
                      render={({ field }) => (
                        <Select value={field.value || NO_SPRINT} onValueChange={(next) => setValue("sprintId", next === NO_SPRINT ? "" : (next ?? ""), { shouldDirty: true })}>
                          <SelectTrigger className="w-full" aria-label={t("sprint.label")}>
                            <SelectValue>
                              {(value: string) => (value === NO_SPRINT ? t("sprint.none") : (sprints.data?.find((sprint) => sprint.id === value)?.name ?? t("sprint.none")))}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NO_SPRINT}>{t("sprint.none")}</SelectItem>
                            {sprintOptions.map((sprint) => (
                              <SelectItem key={sprint.id} value={sprint.id}>
                                {sprint.name}
                                <span className="ml-2 text-xs text-muted-foreground">{tc(`sprintStatus.${sprint.status}`)}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>{t("labels.label")}</Label>
                    <Controller
                      control={control}
                      name="labelIds"
                      render={({ field }) => (
                        <LabelPicker projectId={projectId} slug={slug} value={field.value} onChange={(next) => setValue("labelIds", next, { shouldDirty: true })} max={TASK_LABELS_MAX} />
                      )}
                    />
                  </div>
                </>
              )}
            </FormSection>

            <FormSection id={`${ids}-assignment`} title={t("sections.assignment.title")} description={t("sections.assignment.description")}>
              <Controller
                control={control}
                name="assignMode"
                render={({ field }) => (
                  <Segment
                    label={t("assign.label")}
                    value={field.value}
                    onChange={(next) => setValue("assignMode", next as "people" | "pool", { shouldDirty: true })}
                    options={[
                      { value: "people", label: t("assign.people") },
                      { value: "pool", label: t("assign.pool") },
                    ]}
                  />
                )}
              />
              {inPool ? (
                <div className="space-y-1.5">
                  <Label>{t("assign.poolTeam")}</Label>
                  <Controller
                    control={control}
                    name="poolTeamId"
                    render={({ field }) => (
                      <Select value={field.value || WHOLE_PROJECT} onValueChange={(next) => setValue("poolTeamId", next === WHOLE_PROJECT ? "" : (next ?? ""), { shouldDirty: true })}>
                        <SelectTrigger className="w-full" aria-label={t("assign.poolTeam")}>
                          <SelectValue>
                            {(value: string) => (value === WHOLE_PROJECT ? tc("pool.project") : (teams.data?.find((team) => team.id === value)?.name ?? tc("pool.project")))}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={WHOLE_PROJECT}>{tc("pool.project")}</SelectItem>
                          {teams.data?.map((team) => (
                            <SelectItem key={team.id} value={team.id}>
                              {team.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <p className="text-sm text-muted-foreground">{t("assign.poolHint")}</p>
                </div>
              ) : (
                <Controller
                  control={control}
                  name="assigneeIds"
                  render={({ field }) => (
                    <AssigneePicker
                      projectId={projectId}
                      userId={userId}
                      value={field.value}
                      onChange={(next) => setValue("assigneeIds", next, { shouldDirty: true })}
                      max={TASK_ASSIGNEES_MAX}
                      known={known}
                    />
                  )}
                />
              )}
            </FormSection>

            {advanced && (
              <>
                <FormSection id={`${ids}-checklist`} title={t("sections.checklist.title")} description={t("sections.checklist.description")}>
                  {editing ? (
                    <p className="text-sm text-muted-foreground">{t("checklist.editing")}</p>
                  ) : (
                    <div className="space-y-1.5">
                      <Label htmlFor="task-checklist">{t("checklist.label")}</Label>
                      <Textarea
                        id="task-checklist"
                        rows={4}
                        value={checklistText}
                        onChange={(event) => editChecklist(event.target.value)}
                        placeholder={t("checklist.placeholder")}
                        aria-invalid={!!errors.checklist}
                        aria-describedby={`${ids}-checklist-note`}
                      />
                      {errors.checklist ? (
                        <p id={`${ids}-checklist-note`} role="alert" className="text-sm text-destructive">
                          {tv("tooMany")}
                        </p>
                      ) : (
                        <p id={`${ids}-checklist-note`} className="text-sm text-muted-foreground">
                          {t("checklist.hint", { count: values.checklist?.length ?? 0, max: CHECKLIST_MAX, length: CHECKLIST_TEXT_MAX })}
                        </p>
                      )}
                    </div>
                  )}
                </FormSection>
              </>
            )}
          </div>

          <aside id="task-preview" aria-label={t("preview.title")} className="min-w-0 scroll-mt-24 lg:col-span-5">
            <div className="space-y-3 lg:sticky lg:top-24">
              <div className="space-y-0.5">
                <h2 className="font-heading text-base font-semibold text-foreground">{t("preview.title")}</h2>
                <p className="text-sm text-muted-foreground">{t("preview.caption")}</p>
              </div>
              <div className="mx-auto max-w-sm lg:max-w-none">
                <TaskPreview
                  advanced={advanced}
                  creationMode={mode}
                  projectId={projectId}
                  projectName={project.name}
                  taskKey={task?.taskKey ?? null}
                  status={task?.status ?? "BACKLOG"}
                  priority={priority}
                  title={values.title ?? ""}
                  description={descriptionText}
                  estimatePoints={advanced ? values.estimatePoints ?? null : null}
                  deadlineDate={values.deadlineDate ?? ""}
                  deadlineTime={values.deadlineTime ?? ""}
                  labelIds={advanced ? values.labelIds ?? [] : []}
                  assigneeIds={inPool ? [] : values.assigneeIds ?? []}
                  inPool={inPool}
                  poolTeamId={values.poolTeamId ?? ""}
                  parent={advanced ? parent : null}
                  checklistCount={advanced ? values.checklist?.length ?? 0 : 0}
                  sprintId={advanced ? values.sprintId ?? "" : ""}
                  known={known}
                />
              </div>
            </div>
          </aside>
        </div>

        <div data-sticky-actions className="sticky bottom-0 z-20 -mx-4 -mb-6 mt-10 sm:-mb-8 border-t bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:-mx-8 sm:px-8">
          <div className="flex items-center justify-between gap-2">
            {leaving ? <ConfirmDialog
              trigger={<Button type="button" variant="outline">{t("cancel")}</Button>}
              title={tm("leaveTitle")}
              description={tm("leaveDescription")}
              confirmLabel={tm("leave")}
              cancelLabel={tm("stay")}
              onConfirm={async () => { created.current = true; router.push(backHref); }}
            /> : <Link href={backHref} className={buttonVariants({ variant: "outline" })}>{t("cancel")}</Link>}
            <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
              <a href="#task-preview" className={buttonVariants({ variant: "ghost", className: "lg:hidden" })}>
                <Eye size={16} data-icon="inline-start" aria-hidden="true" />
                <span className="sr-only min-[440px]:not-sr-only">{t("preview.show")}</span>
              </a>
              <Button type="submit" className="h-auto min-h-10 min-w-0 shrink whitespace-normal px-3 py-2" disabled={mutation.isPending || !canSave}>
                {mutation.isPending && <CircleNotch size={16} className="animate-spin" aria-hidden="true" />}
                {t(editing ? "save" : "submit")}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

function TaskFormView({ taskId, ...context }: ProjectGateContext & { taskId?: string }) {
  const te = useTranslations("errors");
  const t = useTranslations("tasks.form");
  const searchParams = useSearchParams();
  const editing = taskId !== undefined;
  const parentParam = editing ? "" : (searchParams.get("parent") ?? "");
  const sprintParam = editing ? "" : (searchParams.get("sprint") ?? "");

  const task = useTask(context.projectId, taskId ?? "");
  const preParent = useTask(context.projectId, parentParam);

  if (!context.isManager) {
    return (
      <div className="space-y-4">
        <p role="alert" className="text-sm text-destructive">{te("forbidden")}</p>
        <Link href={`/projects/${context.slug}/tasks`} className={buttonVariants({ variant: "outline" })}>
          {t("back")}
        </Link>
      </div>
    );
  }
  if ((editing && task.isPending) || (!!parentParam && preParent.isPending)) {
    return <p className="text-sm text-muted-foreground" aria-busy="true">{t("loading")}</p>;
  }
  if (editing && (task.isError || !task.data)) {
    return (
      <div className="space-y-4">
        <p role="alert" className="text-sm text-destructive">{te("notFound")}</p>
        <Link href={`/projects/${context.slug}/tasks`} className={buttonVariants({ variant: "outline" })}>
          {t("back")}
        </Link>
      </div>
    );
  }

  if (!editing && context.project.taskManagementMode === null) return <TaskModelSetting project={context.project} initial />;

  const initialParent: TaskRef | null = preParent.data ? { id: preParent.data.id, key: preParent.data.taskKey, title: preParent.data.title } : null;
  return <TaskFormBody {...context} task={task.data} initialSprintId={sprintParam} initialParent={initialParent} key={task.data?.id ?? "new"} />;
}

/** Create (`taskId` omitted) and edit share one full-page form with a live task preview. */
export function TaskFormPage({ slug, taskId }: { slug: string; taskId?: string }) {
  return <ProjectGate slug={slug}>{(context) => <TaskFormView {...context} taskId={taskId} />}</ProjectGate>;
}

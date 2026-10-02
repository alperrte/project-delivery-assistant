import { z } from "zod";
import { toDeadlineIso } from "./deadline";
import { ESTIMATE_POINTS, TASK_PRIORITIES, type PoolInput, type Task, type TaskPriority } from "./types";

export const TASK_TITLE_MAX = 160;
export const TASK_DESCRIPTION_MAX = 10_000;
export const TASK_ASSIGNEES_MAX = 20;
export const TASK_LABELS_MAX = 10;
export const CHECKLIST_TEXT_MAX = 200;
export const CHECKLIST_MAX = 50;
export const BLOCK_REASON_MAX = 500;
export const COMMENT_MAX = 10_000;
export const WORKLOG_NOTE_MAX = 500;
export const WORKLOG_MINUTES_MAX = 1440;
export const TIME_ESTIMATE_MAX_MINUTES = 100_000;
export const MAX_MENTIONS = 20;

const digits = /^\d{0,5}$/;

/** Error messages are keys under the `validation` i18n namespace, like every other form. */
export const taskFormSchema = z
  .object({
    title: z.string().trim().min(1, "required").max(TASK_TITLE_MAX, "maxLength"),
    description: z.string().max(TASK_DESCRIPTION_MAX, "maxLength"),
    priority: z.enum(TASK_PRIORITIES),
    /** `null` means not estimated. */
    estimatePoints: z.number().nullable().refine((value) => value === null || (ESTIMATE_POINTS as readonly number[]).includes(value), "required"),
    estimateHours: z.string().regex(digits, "number"),
    estimateMinutes: z.string().regex(digits, "number"),
    startDate: z.string(),
    deadlineDate: z.string(),
    deadlineTime: z.string(),
    sprintId: z.string(),
    labelIds: z.array(z.string()).max(TASK_LABELS_MAX, "tooMany"),
    parentTaskId: z.string(),
    assignMode: z.enum(["people", "pool"]),
    assigneeIds: z.array(z.string()).max(TASK_ASSIGNEES_MAX, "tooMany"),
    /** Empty string opens the pool to the whole project. */
    poolTeamId: z.string(),
    checklist: z.array(z.string().max(CHECKLIST_TEXT_MAX, "maxLength")).max(CHECKLIST_MAX, "tooMany"),
  })
  .superRefine((values, ctx) => {
    if (values.deadlineTime && !values.deadlineDate) {
      ctx.addIssue({ code: "custom", path: ["deadlineDate"], message: "timeNeedsDate" });
    }
    if (values.startDate && values.deadlineDate && values.deadlineDate < values.startDate) {
      ctx.addIssue({ code: "custom", path: ["deadlineDate"], message: "taskDateOrder" });
    }
    const minutes = estimateMinutes(values.estimateHours, values.estimateMinutes);
    if (minutes !== null && (minutes < 1 || minutes > TIME_ESTIMATE_MAX_MINUTES)) {
      ctx.addIssue({ code: "custom", path: ["estimateHours"], message: "timeEstimateRange" });
    }
  });

export type TaskFormValues = z.infer<typeof taskFormSchema>;

export const emptyTaskForm: TaskFormValues = {
  title: "",
  description: "",
  priority: "MEDIUM",
  estimatePoints: null,
  estimateHours: "",
  estimateMinutes: "",
  startDate: "",
  deadlineDate: "",
  deadlineTime: "",
  sprintId: "",
  labelIds: [],
  parentTaskId: "",
  assignMode: "people",
  assigneeIds: [],
  poolTeamId: "",
  checklist: [],
};

/** Hours and minutes inputs -> total minutes, or `null` when both are empty. */
export function estimateMinutes(hours: string, minutes: string): number | null {
  if (!hours.trim() && !minutes.trim()) return null;
  return (Number(hours) || 0) * 60 + (Number(minutes) || 0);
}

/** What `POST` / `PATCH /projects/{id}/tasks` take. */
export type TaskPayload = {
  title: string;
  description: string | null;
  priority: TaskPriority;
  startDate: string | null;
  deadlineAt: string | null;
  estimatePoints: number | null;
  timeEstimateMinutes: number | null;
  assigneeIds: string[];
  labelIds: string[];
  parentTaskId: string | null;
  sprintId: string | null;
  pool: PoolInput;
};

export function toTaskPayload(values: TaskFormValues): TaskPayload {
  const inPool = values.assignMode === "pool";
  return {
    title: values.title.trim(),
    description: values.description.trim() ? values.description.trim() : null,
    priority: values.priority,
    startDate: values.startDate || null,
    deadlineAt: values.deadlineDate ? toDeadlineIso(values.deadlineDate, values.deadlineTime) : null,
    estimatePoints: values.estimatePoints,
    timeEstimateMinutes: estimateMinutes(values.estimateHours, values.estimateMinutes),
    assigneeIds: inPool ? [] : values.assigneeIds,
    labelIds: values.labelIds,
    parentTaskId: values.parentTaskId || null,
    sprintId: values.sprintId || null,
    // `open: false` is a no-op unless the task sits in the pool, in which case switching to people closes it.
    pool: inPool ? { open: true, teamId: values.poolTeamId || null } : { open: false, teamId: null },
  };
}

/** The update endpoint replaces every field, so an inline edit sends the whole task with one field patched. */
export function payloadFromTask(task: Task, patch: Partial<TaskPayload> = {}): TaskPayload {
  return {
    title: task.title,
    description: task.description,
    priority: task.priority,
    startDate: task.startDate,
    deadlineAt: task.deadlineAt,
    estimatePoints: task.estimatePoints,
    timeEstimateMinutes: task.timeEstimateMinutes,
    assigneeIds: task.assigneeIds,
    labelIds: task.labels.map((label) => label.id),
    parentTaskId: task.parent?.id ?? null,
    sprintId: task.sprint?.id ?? null,
    pool: task.pool?.open ? { open: true, teamId: task.pool.teamId } : { open: false, teamId: null },
    ...patch,
  };
}

export const blockSchema =z.object({ reason: z.string().trim().max(BLOCK_REASON_MAX, "maxLength") });
export type BlockValues = z.infer<typeof blockSchema>;

export const commentSchema = z.object({ body: z.string().trim().min(1, "required").max(COMMENT_MAX, "maxLength") });
export type CommentValues = z.infer<typeof commentSchema>;

export const checklistItemSchema = z.object({ text: z.string().trim().min(1, "required").max(CHECKLIST_TEXT_MAX, "maxLength") });

export const worklogSchema = z
  .object({
    hours: z.string().regex(digits, "number"),
    minutes: z.string().regex(digits, "number"),
    workDate: z.string().min(1, "required"),
    note: z.string().max(WORKLOG_NOTE_MAX, "maxLength"),
  })
  .superRefine((values, ctx) => {
    const total = estimateMinutes(values.hours, values.minutes);
    if (total === null || total < 1 || total > WORKLOG_MINUTES_MAX) {
      ctx.addIssue({ code: "custom", path: ["minutes"], message: "worklogRange" });
    }
  });
export type WorklogValues = z.infer<typeof worklogSchema>;

export const relationSchema = z.object({
  type: z.enum(["BLOCKS", "RELATES", "DUPLICATES"]),
  targetTaskId: z.string().min(1, "required"),
});
export type RelationValues = z.infer<typeof relationSchema>;

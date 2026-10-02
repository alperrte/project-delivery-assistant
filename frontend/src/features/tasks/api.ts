import { apiRequest, apiUrl } from "@/lib/api/client";
import type { Page } from "@/types/pagination";
import type { TaskPayload } from "./schemas";
import type {
  Attachment,
  ChecklistItem,
  Comment,
  MyTaskCounts,
  MyTasksPage,
  MyTasksParams,
  PersonRef,
  RelationType,
  Relations,
  Task,
  TaskHistoryEntry,
  TaskListParams,
  TaskStatus,
  TimelineEntry,
  TimelineFilter,
  WatchState,
  Worklog,
  WorklogList,
} from "./types";

export const TASK_PAGE_SIZE = 25;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS = 20;

type QueryValue = string | number | boolean | null | undefined | readonly (string | number)[];

/** Drops empty values and `false` flags, repeats array parameters (`status=A&status=B`). */
export function buildQuery(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === false || value === "") continue;
    if (Array.isArray(value)) {
      for (const item of value) search.append(key, String(item));
    } else {
      search.append(key, String(value));
    }
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

const base = (projectId: string, taskId?: string) =>
  taskId ? `/projects/${projectId}/tasks/${taskId}` : `/projects/${projectId}/tasks`;

function listQuery(params: TaskListParams): string {
  const { sort = "updatedAt", direction = "desc", page = 0, size = TASK_PAGE_SIZE, ...filters } = params;
  return buildQuery({ ...filters, sort: `${sort},${direction}`, page, size });
}

export const tasksApi = {
  list: (projectId: string, params: TaskListParams = {}) =>
    apiRequest<Page<Task>>(`${base(projectId)}${listQuery(params)}`),
  detail: (projectId: string, taskId: string) => apiRequest<Task>(base(projectId, taskId)),
  create: (projectId: string, body: TaskPayload) => apiRequest<Task>(base(projectId), { method: "POST", body }),
  update: (projectId: string, taskId: string, body: TaskPayload) =>
    apiRequest<Task>(base(projectId, taskId), { method: "PATCH", body }),
  archive: (projectId: string, taskId: string) => apiRequest<void>(base(projectId, taskId), { method: "DELETE" }),

  changeStatus: (projectId: string, taskId: string, status: TaskStatus) =>
    apiRequest<Task>(`${base(projectId, taskId)}/status`, { method: "PATCH", body: { status } }),
  setBlocked: (projectId: string, taskId: string, blocked: boolean, reason?: string) =>
    apiRequest<Task>(`${base(projectId, taskId)}/blocked`, { method: "PATCH", body: { blocked, reason: reason || null } }),
  replaceAssignees: (projectId: string, taskId: string, assigneeIds: string[]) =>
    apiRequest<{ assigneeIds: string[] }>(`${base(projectId, taskId)}/assignees`, { method: "PUT", body: { assigneeIds } }),
  replaceLabels: (projectId: string, taskId: string, labelIds: string[]) =>
    apiRequest<Task>(`${base(projectId, taskId)}/labels`, { method: "PUT", body: { labelIds } }),
  /** `null` moves the task to the backlog. */
  changeSprint: (projectId: string, taskId: string, sprintId: string | null) =>
    apiRequest<Task>(`${base(projectId, taskId)}/sprint`, { method: "PUT", body: { sprintId } }),
  subtasks: (projectId: string, taskId: string) => apiRequest<Task[]>(`${base(projectId, taskId)}/subtasks`),
  history: (projectId: string, taskId: string) => apiRequest<TaskHistoryEntry[]>(`${base(projectId, taskId)}/history`),

  claim: (projectId: string, taskId: string) => apiRequest<Task>(`${base(projectId, taskId)}/claim`, { method: "POST" }),
  release: (projectId: string, taskId: string) => apiRequest<Task>(`${base(projectId, taskId)}/release`, { method: "POST" }),

  checklist: (projectId: string, taskId: string) => apiRequest<ChecklistItem[]>(`${base(projectId, taskId)}/checklist`),
  addChecklistItem: (projectId: string, taskId: string, text: string) =>
    apiRequest<ChecklistItem>(`${base(projectId, taskId)}/checklist`, { method: "POST", body: { text } }),
  updateChecklistItem: (projectId: string, taskId: string, itemId: string, patch: { text?: string; done?: boolean }) =>
    apiRequest<ChecklistItem>(`${base(projectId, taskId)}/checklist/${itemId}`, { method: "PATCH", body: patch }),
  deleteChecklistItem: (projectId: string, taskId: string, itemId: string) =>
    apiRequest<void>(`${base(projectId, taskId)}/checklist/${itemId}`, { method: "DELETE" }),
  reorderChecklist: (projectId: string, taskId: string, itemIds: string[]) =>
    apiRequest<ChecklistItem[]>(`${base(projectId, taskId)}/checklist/order`, { method: "PUT", body: { itemIds } }),

  comments: (projectId: string, taskId: string, page = 0, size = 50) =>
    apiRequest<Page<Comment>>(`${base(projectId, taskId)}/comments${buildQuery({ page, size })}`),
  addComment: (projectId: string, taskId: string, body: string) =>
    apiRequest<Comment>(`${base(projectId, taskId)}/comments`, { method: "POST", body: { body } }),
  editComment: (projectId: string, taskId: string, commentId: string, body: string) =>
    apiRequest<Comment>(`${base(projectId, taskId)}/comments/${commentId}`, { method: "PATCH", body: { body } }),
  deleteComment: (projectId: string, taskId: string, commentId: string) =>
    apiRequest<void>(`${base(projectId, taskId)}/comments/${commentId}`, { method: "DELETE" }),
  activity: (projectId: string, taskId: string, filter: TimelineFilter, page = 0, size = 30) =>
    apiRequest<Page<TimelineEntry>>(`${base(projectId, taskId)}/activity${buildQuery({ filter, page, size })}`),

  relations: (projectId: string, taskId: string) => apiRequest<Relations>(`${base(projectId, taskId)}/relations`),
  addRelation: (projectId: string, taskId: string, type: RelationType, targetTaskId: string) =>
    apiRequest<Relations>(`${base(projectId, taskId)}/relations`, { method: "POST", body: { type, targetTaskId } }),
  removeRelation: (projectId: string, taskId: string, relationId: string) =>
    apiRequest<Relations>(`${base(projectId, taskId)}/relations/${relationId}`, { method: "DELETE" }),

  watchers: (projectId: string, taskId: string) => apiRequest<PersonRef[]>(`${base(projectId, taskId)}/watchers`),
  watch: (projectId: string, taskId: string) => apiRequest<WatchState>(`${base(projectId, taskId)}/watch`, { method: "PUT" }),
  unwatch: (projectId: string, taskId: string) =>
    apiRequest<WatchState>(`${base(projectId, taskId)}/watch`, { method: "DELETE" }),

  worklogs: (projectId: string, taskId: string) => apiRequest<WorklogList>(`${base(projectId, taskId)}/worklogs`),
  addWorklog: (projectId: string, taskId: string, body: WorklogBody) =>
    apiRequest<WorklogList>(`${base(projectId, taskId)}/worklogs`, { method: "POST", body }),
  updateWorklog: (projectId: string, taskId: string, worklogId: string, body: WorklogBody) =>
    apiRequest<WorklogList>(`${base(projectId, taskId)}/worklogs/${worklogId}`, { method: "PATCH", body }),
  deleteWorklog: (projectId: string, taskId: string, worklogId: string) =>
    apiRequest<WorklogList>(`${base(projectId, taskId)}/worklogs/${worklogId}`, { method: "DELETE" }),

  attachments: (projectId: string, taskId: string) => apiRequest<Attachment[]>(`${base(projectId, taskId)}/attachments`),
  uploadAttachment: (projectId: string, taskId: string, file: File) => {
    const body = new FormData();
    body.append("file", file);
    return apiRequest<Attachment>(`${base(projectId, taskId)}/attachments`, { method: "POST", body });
  },
  deleteAttachment: (projectId: string, taskId: string, attachmentId: string) =>
    apiRequest<void>(`${base(projectId, taskId)}/attachments/${attachmentId}`, { method: "DELETE" }),
};

export type WorklogBody = Pick<Worklog, "minutes" | "workDate"> & { note: string | null };

/** Cookie-authenticated GET, so an `<img src>` or `<a href download>` works without a fetch. */
export function attachmentContentUrl(projectId: string, taskId: string, attachmentId: string): string {
  return apiUrl(`${base(projectId, taskId)}/attachments/${attachmentId}/content`);
}

/** Only these types are served inline by the backend; everything else downloads. */
export function isPreviewableImage(contentType: string): boolean {
  return /^image\/(png|jpeg|webp|gif)$/.test(contentType);
}

export const myTasksApi = {
  mine: (params: MyTasksParams = {}) => {
    const { scope = "OPEN", activeSprint, sort = "deadlineAt", direction = "asc", page = 0, size = TASK_PAGE_SIZE, ...rest } = params;
    return apiRequest<MyTasksPage>(
      `/tasks/mine${buildQuery({ ...rest, scope, sprint: activeSprint ? "active" : undefined, sort, direction, page, size })}`,
    );
  },
  counts: () => apiRequest<MyTaskCounts>("/tasks/counts"),
  pool: (params: { projectId?: string; page?: number; size?: number } = {}) =>
    apiRequest<Page<Task>>(`/tasks/pool${buildQuery({ projectId: params.projectId, page: params.page ?? 0, size: params.size ?? TASK_PAGE_SIZE })}`),
};

/** Pulls every page; used for pickers (parent task, sprint board columns) where the client groups the result. */
export async function allTaskPages(projectId: string, params: TaskListParams = {}): Promise<Task[]> {
  const size = 100;
  const first = await tasksApi.list(projectId, { ...params, page: 0, size });
  const rest = await Promise.all(
    Array.from({ length: Math.max(first.totalPages - 1, 0) }, (_, index) =>
      tasksApi.list(projectId, { ...params, page: index + 1, size })),
  );
  return [first, ...rest].flatMap((page) => page.content);
}

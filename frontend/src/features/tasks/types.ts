/** Mirrors the backend task contract (`com.pda.task`); see `.agents/SECURITY.md` §11 for the endpoint matrix. */

export const TASK_STATUSES = ["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "TESTING", "DONE"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export type SprintStatus = "PLANNED" | "ACTIVE" | "COMPLETED";

/** Fibonacci story points the backend accepts; `null` means not estimated. */
export const ESTIMATE_POINTS = [0, 1, 2, 3, 5, 8, 13, 21] as const;

export const LABEL_COLORS = ["slate", "red", "orange", "amber", "green", "teal", "blue", "violet", "pink"] as const;
export type LabelColor = (typeof LABEL_COLORS)[number];

export type PersonRef = { userId: string; nickname: string | null; profilePhotoVersion?: number | null };
export type LabelRef = { id: string; name: string; color: LabelColor };
export type TaskRef = { id: string; key: string; title: string };
export type SprintRef = { id: string; name: string; status: SprintStatus };
/** `claimed` is true when the current assignee took the task from the pool (so they may give it back). */
export type PoolRef = { open: boolean; claimed: boolean; teamId: string | null; teamName: string | null };
export type TaskProjectRef = { id: string; slug: string; name: string; logoVersion: number | null };

export type TaskCreationMode = "SIMPLE" | "ADVANCED";

export type Task = {
  creationMode: TaskCreationMode;
  id: string;
  projectId: string;
  taskNumber: number;
  taskKey: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  /** `YYYY-MM-DD`, a plain calendar day. */
  startDate: string | null;
  /** ISO instant; the date and the time of day are both meaningful. */
  deadlineAt: string | null;
  overdue: boolean;
  blocked: boolean;
  blockedReason: string | null;
  /** True while some task that BLOCKS this one is not done yet. */
  hasOpenBlockers: boolean;
  createdBy: string;
  createdByName: string | null;
  createdAt: string;
  updatedBy: string | null;
  updatedByName: string | null;
  updatedAt: string;
  archivedAt: string | null;
  version: number;
  assigneeIds: string[];
  assignees: PersonRef[];
  labels: LabelRef[];
  parent: TaskRef | null;
  subtaskCount: number;
  subtaskDoneCount: number;
  checklistTotal: number;
  checklistDone: number;
  commentCount: number;
  attachmentCount: number;
  estimatePoints: number | null;
  timeEstimateMinutes: number | null;
  loggedMinutes: number;
  sprint: SprintRef | null;
  pool: PoolRef | null;
  watching: boolean;
  project: TaskProjectRef | null;
};

export type TaskHistoryEntry = {
  id: string;
  previousStatus: TaskStatus | null;
  newStatus: TaskStatus;
  changedBy: string;
  changedAt: string;
};

export type ChecklistItem = {
  id: string;
  text: string;
  done: boolean;
  position: number;
  doneBy: string | null;
  doneAt: string | null;
};

export type Comment = {
  id: string;
  taskId: string;
  authorId: string;
  authorName: string | null;
  authorPhotoVersion?: number | null;
  /** `null` for a deleted comment: it keeps its place in the thread without a body. */
  body: string | null;
  deleted: boolean;
  createdAt: string;
  editedAt: string | null;
  mentions: PersonRef[];
};

export type ActivityType =
  | "CREATED" | "FIELD_CHANGED" | "STATUS_CHANGED" | "BLOCKED" | "UNBLOCKED" | "ASSIGNED" | "UNASSIGNED"
  | "POOL_OPENED" | "POOL_CLOSED" | "CLAIMED" | "RELEASED" | "LABELS_CHANGED" | "SPRINT_CHANGED" | "PARENT_CHANGED"
  | "SUBTASK_ADDED" | "CHECKLIST_ITEM_ADDED" | "CHECKLIST_ITEM_DONE" | "CHECKLIST_ITEM_REOPENED"
  | "RELATION_ADDED" | "RELATION_REMOVED" | "ATTACHMENT_ADDED" | "ATTACHMENT_REMOVED" | "WORKLOG_ADDED" | "ARCHIVED";

export type TaskEvent = {
  id: string;
  actorId: string | null;
  actorName: string | null;
  type: ActivityType;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
};

/** Exactly one of `comment` / `event` is set, matching `kind`. */
export type TimelineEntry =
  | { kind: "COMMENT"; at: string; comment: Comment; event: null }
  | { kind: "EVENT"; at: string; comment: null; event: TaskEvent };

export type TimelineFilter = "ALL" | "COMMENTS" | "EVENTS";

export type RelationType = "BLOCKS" | "RELATES" | "DUPLICATES";
export type RelatedTask = { relationId: string; taskId: string; key: string; title: string; status: TaskStatus };
export type Relations = {
  blocks: RelatedTask[];
  blockedBy: RelatedTask[];
  relatesTo: RelatedTask[];
  duplicates: RelatedTask[];
  duplicatedBy: RelatedTask[];
};

export type Attachment = {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedBy: string;
  uploadedByName: string | null;
  uploadedAt: string;
};

export type Worklog = {
  id: string;
  userId: string;
  userName: string | null;
  minutes: number;
  /** `YYYY-MM-DD`. */
  workDate: string;
  note: string | null;
  createdAt: string;
};
export type WorklogList = { entries: Worklog[]; totalMinutes: number };

export type WatchState = { watching: boolean };

export type MyTaskCounts = { open: number; overdue: number; dueSoon: number; blocked: number; poolAvailable: number };
export type MyTasksScope = "OPEN" | "DONE" | "ALL";
export type MyTasksPage = {
  content: Task[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  counts: MyTaskCounts;
};

export type TaskSortField = "taskNumber" | "createdAt" | "updatedAt" | "deadlineAt" | "priority";
export type SortDirection = "asc" | "desc";

/** Server-side list filters of `GET /projects/{id}/tasks`. Empty arrays and `false` flags are not sent. */
export type TaskListParams = {
  creationMode?: TaskCreationMode;
  status?: TaskStatus[];
  priority?: TaskPriority[];
  assigneeId?: string;
  unassigned?: boolean;
  q?: string;
  labelId?: string[];
  sprintId?: string;
  backlog?: boolean;
  pool?: boolean;
  parentId?: string;
  topLevel?: boolean;
  overdue?: boolean;
  blocked?: boolean;
  sort?: TaskSortField;
  direction?: SortDirection;
  page?: number;
  size?: number;
};

export type MyTasksParams = {
  scope?: MyTasksScope;
  status?: TaskStatus[];
  projectId?: string;
  overdue?: boolean;
  activeSprint?: boolean;
  sort?: "deadlineAt" | "updatedAt" | "priority";
  direction?: SortDirection;
  page?: number;
  size?: number;
};

/** Who may take a pool task; `teamId` null opens it to the whole project. */
export type PoolInput = { open: boolean; teamId: string | null };

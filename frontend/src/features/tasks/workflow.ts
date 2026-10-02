import { TASK_PRIORITIES, TASK_STATUSES, type LabelColor, type TaskPriority, type TaskStatus } from "./types";

/**
 * Client mirror of `Task.changeStatus` in the backend. The server stays the authority (it answers 409
 * `TASK_INVALID_TRANSITION`); this table only decides which targets the UI offers and which board columns accept a drop.
 */
const TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  BACKLOG: ["TODO"],
  TODO: ["BACKLOG", "IN_PROGRESS"],
  IN_PROGRESS: ["TODO", "IN_REVIEW"],
  IN_REVIEW: ["IN_PROGRESS", "TESTING"],
  TESTING: ["IN_REVIEW", "DONE"],
  DONE: ["IN_PROGRESS"],
};

export function allowedTransitions(status: TaskStatus): readonly TaskStatus[] {
  return TRANSITIONS[status];
}

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Board and filter order. */
export const STATUS_ORDER: readonly TaskStatus[] = TASK_STATUSES;
export const ACTIVE_STATUSES: readonly TaskStatus[] = TASK_STATUSES.filter((status) => status !== "DONE");

export function isOpenStatus(status: TaskStatus): boolean {
  return status !== "DONE";
}

const PRIORITY_RANK: Record<TaskPriority, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

export function priorityRank(priority: TaskPriority): number {
  return PRIORITY_RANK[priority];
}

/** Most urgent first. */
export const PRIORITY_DESC: readonly TaskPriority[] = [...TASK_PRIORITIES].reverse();

/** Dot fill of a status; the same semantics everywhere a status is a small marker. */
export function statusDotClass(status: TaskStatus): string {
  switch (status) {
    case "TODO":
      return "bg-muted-foreground";
    case "IN_PROGRESS":
      return "bg-primary";
    case "IN_REVIEW":
      return "bg-warning";
    case "TESTING":
      return "bg-label-violet";
    case "DONE":
      return "bg-success";
    case "BACKLOG":
    default:
      return "bg-muted-foreground/40";
  }
}

export function statusBadgeClass(status: TaskStatus): string {
  switch (status) {
    case "IN_PROGRESS":
      return "border border-primary/25 bg-primary/10 text-primary";
    case "IN_REVIEW":
      return "border border-warning/25 bg-warning/10 text-warning";
    case "TESTING":
      return "border border-label-violet/25 bg-label-violet/10 text-label-violet";
    case "DONE":
      return "border border-success/25 bg-success/10 text-success";
    case "TODO":
      return "border border-border-strong bg-transparent text-foreground";
    case "BACKLOG":
    default:
      return "border border-border bg-muted text-muted-foreground";
  }
}

export function priorityDotClass(priority: TaskPriority): string {
  switch (priority) {
    case "CRITICAL":
      return "bg-destructive";
    case "HIGH":
      return "bg-warning";
    case "MEDIUM":
      return "bg-primary";
    case "LOW":
    default:
      return "bg-muted-foreground/40";
  }
}

export function priorityBadgeClass(priority: TaskPriority): string {
  switch (priority) {
    case "CRITICAL":
      return "border border-destructive/25 bg-destructive/10 text-destructive";
    case "HIGH":
      return "border border-warning/25 bg-warning/10 text-warning";
    case "MEDIUM":
      return "border border-primary/25 bg-primary/10 text-primary";
    case "LOW":
    default:
      return "border border-border bg-muted text-muted-foreground";
  }
}

/** Full class strings so Tailwind can see them; a label color is a token name, never a hex. */
const LABEL_BADGE: Record<LabelColor, string> = {
  slate: "border-label-slate/25 bg-label-slate/10 text-label-slate",
  red: "border-label-red/25 bg-label-red/10 text-label-red",
  orange: "border-label-orange/25 bg-label-orange/10 text-label-orange",
  amber: "border-label-amber/25 bg-label-amber/10 text-label-amber",
  green: "border-label-green/25 bg-label-green/10 text-label-green",
  teal: "border-label-teal/25 bg-label-teal/10 text-label-teal",
  blue: "border-label-blue/25 bg-label-blue/10 text-label-blue",
  violet: "border-label-violet/25 bg-label-violet/10 text-label-violet",
  pink: "border-label-pink/25 bg-label-pink/10 text-label-pink",
};

const LABEL_DOT: Record<LabelColor, string> = {
  slate: "bg-label-slate",
  red: "bg-label-red",
  orange: "bg-label-orange",
  amber: "bg-label-amber",
  green: "bg-label-green",
  teal: "bg-label-teal",
  blue: "bg-label-blue",
  violet: "bg-label-violet",
  pink: "bg-label-pink",
};

export function labelBadgeClass(color: string): string {
  return LABEL_BADGE[color as LabelColor] ?? LABEL_BADGE.slate;
}

export function labelDotClass(color: string): string {
  return LABEL_DOT[color as LabelColor] ?? LABEL_DOT.slate;
}

/** Deadline text tone: late is destructive, within a day is warning, otherwise quiet. */
export function deadlineToneClass(state: "overdue" | "soon" | "upcoming"): string {
  switch (state) {
    case "overdue":
      return "text-destructive";
    case "soon":
      return "text-warning";
    case "upcoming":
    default:
      return "text-muted-foreground";
  }
}

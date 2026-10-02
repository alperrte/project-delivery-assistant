import type { SprintStatus, TaskStatus } from "@/features/tasks/types";

export type { SprintStatus };

export type Sprint = {
  id: string;
  sequence: number;
  name: string;
  goal: string | null;
  /** `YYYY-MM-DD`. */
  startDate: string;
  endDate: string;
  status: SprintStatus;
  taskCount: number;
  completedAt: string | null;
  version: number;
};

export type BurndownPoint = {
  /** `YYYY-MM-DD`. */
  date: string;
  donePoints: number;
  doneTasks: number;
  remainingPoints: number;
  remainingTasks: number;
};

export type SprintSummary = {
  sprint: Sprint;
  totalTasks: number;
  doneTasks: number;
  totalPoints: number;
  donePoints: number;
  byStatus: Partial<Record<TaskStatus, number>>;
  loggedMinutes: number;
  burndown: BurndownPoint[];
};

/** Where the open tasks of a completed sprint go: another sprint's id or the backlog. */
export type CompleteTarget = string | "BACKLOG";

import type { Task, TaskStatus } from "./types";
import { STATUS_ORDER } from "./workflow";
import type { Grouping } from "./filters";

export type TaskGroup =
  | { id: string; kind: "status"; status: TaskStatus; tasks: Task[] }
  | { id: string; kind: "assignee"; userId: string | null; name: string | null; profilePhotoVersion?: number | null; tasks: Task[] }
  | { id: string; kind: "sprint"; sprintId: string | null; name: string | null; status: string | null; tasks: Task[] };

const SPRINT_RANK: Record<string, number> = { ACTIVE: 0, PLANNED: 1, COMPLETED: 2 };

/**
 * Splits an already sorted list into display groups, keeping the incoming order inside each group.
 * A task with several assignees appears under each of them, so group counts can add up to more than the list.
 */
export function groupTasks(tasks: Task[], grouping: Exclude<Grouping, "none">): TaskGroup[] {
  if (grouping === "status") {
    return STATUS_ORDER.map<TaskGroup>((status) => ({ id: status, kind: "status", status, tasks: tasks.filter((task) => task.status === status) })).filter(
      (group) => group.tasks.length > 0,
    );
  }

  if (grouping === "assignee") {
    const byUser = new Map<string, TaskGroup & { kind: "assignee" }>();
    const unassigned: Task[] = [];
    for (const task of tasks) {
      if (task.assignees.length === 0) unassigned.push(task);
      for (const person of task.assignees) {
        const group = byUser.get(person.userId) ?? { id: person.userId, kind: "assignee" as const, userId: person.userId, name: person.nickname, profilePhotoVersion: person.profilePhotoVersion, tasks: [] };
        group.tasks.push(task);
        byUser.set(person.userId, group);
      }
    }
    const people = [...byUser.values()].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
    return unassigned.length ? [...people, { id: "none", kind: "assignee", userId: null, name: null, tasks: unassigned }] : people;
  }

  const bySprint = new Map<string, TaskGroup & { kind: "sprint" }>();
  const backlog: Task[] = [];
  for (const task of tasks) {
    if (!task.sprint) {
      backlog.push(task);
      continue;
    }
    const group = bySprint.get(task.sprint.id) ?? {
      id: task.sprint.id,
      kind: "sprint" as const,
      sprintId: task.sprint.id,
      name: task.sprint.name,
      status: task.sprint.status,
      tasks: [],
    };
    group.tasks.push(task);
    bySprint.set(task.sprint.id, group);
  }
  const sprints = [...bySprint.values()].sort(
    (a, b) => (SPRINT_RANK[a.status ?? ""] ?? 3) - (SPRINT_RANK[b.status ?? ""] ?? 3) || (a.name ?? "").localeCompare(b.name ?? ""),
  );
  return backlog.length ? [...sprints, { id: "backlog", kind: "sprint", sprintId: null, name: null, status: null, tasks: backlog }] : sprints;
}

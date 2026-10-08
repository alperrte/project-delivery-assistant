"use client";

import { useMemo } from "react";
import { dateKeyOf } from "@/features/reminders/dates";
import { useAllTasks } from "@/features/tasks/hooks";
import type { Task } from "@/features/tasks/types";

/** `start`: the task's planned first day. `deadline`: the day its deadline falls on (a task due on its start day is one `deadline`). */
export type CalendarTaskKind = "start" | "deadline";
export type CalendarTaskEntry = { task: Task; kind: CalendarTaskKind };

const ORDER: Record<CalendarTaskKind, number> = { deadline: 0, start: 1 };

/**
 * The tasks assigned to `userId` in one project, grouped by the days they start and are due. Everything is read once
 * through the task list (not per month), and shares the project's task query prefix, so any task change refreshes it.
 */
export function useCalendarTasks(projectId: string | undefined, userId: string | undefined) {
  const query = useAllTasks(projectId ?? "", { assigneeId: userId, sort: "deadlineAt", direction: "asc" }, !!projectId && !!userId);

  const byDate = useMemo(() => {
    const grouped = new Map<string, CalendarTaskEntry[]>();
    const add = (key: string, entry: CalendarTaskEntry) => grouped.set(key, [...(grouped.get(key) ?? []), entry]);
    for (const task of query.data ?? []) {
      const due = task.deadlineAt ? dateKeyOf(new Date(task.deadlineAt)) : null;
      if (due) add(due, { task, kind: "deadline" });
      if (task.startDate && task.startDate !== due) add(task.startDate, { task, kind: "start" });
    }
    for (const [key, entries] of grouped) {
      grouped.set(key, [...entries].sort((a, b) => ORDER[a.kind] - ORDER[b.kind] || a.task.taskNumber - b.task.taskNumber));
    }
    return grouped;
  }, [query.data]);

  return { ...query, byDate };
}

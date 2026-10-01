"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { remindersApi } from "../api";
import { monthRange } from "../dates";
import type { Reminder } from "../types";

function monthRemindersKey(projectId: string, from: string, to: string) {
  return ["projects", projectId, "reminders", from, to] as const;
}

/**
 * The reminders of one project for the month containing `month`, grouped by day. Only that month is requested, and
 * the previous month stays on screen while the next one loads so the calendar never blanks out.
 */
export function useMonthReminders(projectId: string | undefined, month: Date) {
  const { from, to } = monthRange(month);
  const query = useQuery({
    queryKey: monthRemindersKey(projectId ?? "", from, to),
    queryFn: () => remindersApi.list(projectId!, from, to),
    enabled: !!projectId,
    // Only carry the previous month over within the same project; another project's reminders must never flash up.
    placeholderData: (previous, previousQuery) => (previousQuery?.queryKey[1] === projectId ? previous : undefined),
  });

  const byDate = useMemo(() => {
    const grouped = new Map<string, Reminder[]>();
    for (const reminder of query.data ?? []) {
      grouped.set(reminder.date, [...(grouped.get(reminder.date) ?? []), reminder]);
    }
    return grouped;
  }, [query.data]);

  return { ...query, byDate };
}

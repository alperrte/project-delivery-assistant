"use client";

import { useLocale, useTranslations } from "next-intl";
import { FlagBanner } from "@phosphor-icons/react";
import { dateFromKey } from "@/features/reminders/dates";
import { ReminderList } from "@/features/reminders/components/reminder-list";
import type { Reminder } from "@/features/reminders/types";
import type { CalendarTaskEntry } from "../hooks/use-calendar-tasks";
import { TaskAgenda } from "./task-agenda";

/** The reminders (and the project deadline, if it falls there) of the selected day, with edit/delete where allowed. */
export function DayAgenda({
  selected,
  reminders,
  tasks = [],
  slug,
  projectId,
  currentUserId,
  isManager,
  isDeadline,
  actions,
}: {
  selected: string;
  reminders: Reminder[];
  /** The user's assigned tasks that start or are due on the selected day. */
  tasks?: CalendarTaskEntry[];
  slug: string;
  projectId: string;
  currentUserId?: string;
  isManager: boolean;
  isDeadline: boolean;
  actions: boolean;
}) {
  const t = useTranslations("calendarPage");
  const locale = useLocale();
  const heading = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(dateFromKey(selected));

  return (
    <section aria-labelledby="calendar-day-heading" aria-live="polite" className="workspace-panel p-5">
      <h2 id="calendar-day-heading" className="text-sm font-semibold">{heading}</h2>
      <div className="mt-3 space-y-1">
        {isDeadline && (
          <p className="flex items-center gap-3 rounded-md p-2 text-sm">
            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-warning/15 text-warning">
              <FlagBanner size={17} aria-hidden="true" />
            </span>
            {t("projectDeadline")}
          </p>
        )}
        {reminders.length > 0 && (
          <ReminderList reminders={reminders} projectId={projectId} currentUserId={currentUserId} isManager={isManager} actions={actions} />
        )}
        <TaskAgenda entries={tasks} slug={slug} />
        {reminders.length === 0 && tasks.length === 0 && !isDeadline && <p className="text-sm leading-6 text-muted-foreground">{t("noItemsForDay")}</p>}
      </div>
    </section>
  );
}

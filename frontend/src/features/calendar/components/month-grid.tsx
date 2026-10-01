"use client";

import { useLocale, useTranslations } from "next-intl";
import { FlagBanner } from "@phosphor-icons/react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { dateFromKey, dateKey } from "@/features/reminders/dates";
import { ReminderMarkers } from "@/features/reminders/components/reminder-markers";
import type { Reminder } from "@/features/reminders/types";

type MonthGridProps = {
  month: Date;
  selected: string;
  today: string;
  byDate: Map<string, Reminder[]>;
  /** The selected project's target end date, drawn as a flag. */
  deadline: string | null;
  onSelect: (key: string) => void;
  /** The small home-page variant: narrow cells, one icon per day with a "+N" count. */
  compact?: boolean;
};

function DeadlineFlag({ compact }: { compact: boolean }) {
  const t = useTranslations("calendarPage");
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span role="img" aria-label={t("projectDeadline")} className="inline-grid size-6 shrink-0 place-items-center rounded-full bg-warning/15 text-warning" />}
      >
        <FlagBanner size={compact ? 13 : 15} aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent>{t("projectDeadline")}</TooltipContent>
    </Tooltip>
  );
}

/**
 * A month of days. A day without reminders shows its number; a day with reminders shows the reminder's type icon in
 * the number's place (several: a few icons, or one with a "+N" count in narrow cells). Pure view: it fetches nothing
 * and owns no state. The day button's accessible name always carries the full date and every reminder.
 */
export function MonthGrid({ month, selected, today, byDate, deadline, onSelect, compact = false }: MonthGridProps) {
  const t = useTranslations("reminders");
  const tc = useTranslations("calendarPage");
  const locale = useLocale();
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const offset = (month.getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const fullDate = new Intl.DateTimeFormat(locale, { dateStyle: "full" });

  return (
    <div className={cn("grid grid-cols-7 text-center", compact ? "gap-y-1 text-xs" : "gap-px overflow-hidden rounded-lg border bg-border text-xs")}>
      {Array.from({ length: 7 }, (_, i) => (
        <div key={i} className={cn("text-muted-foreground", compact ? "pb-2 text-[10px]" : "bg-muted px-2 py-2 text-[11px] font-medium")}>
          {new Date(2026, 5, 1 + i).toLocaleDateString(locale, { weekday: "short" })}
        </div>
      ))}
      {Array.from({ length: offset }, (_, i) => (
        <div key={`space-${i}`} aria-hidden="true" className={compact ? undefined : "min-h-14 bg-card sm:min-h-24"} />
      ))}
      {Array.from({ length: daysInMonth }, (_, i) => {
        const day = i + 1;
        const key = dateKey(year, monthIndex, day);
        const reminders = byDate.get(key) ?? [];
        const hasReminders = reminders.length > 0;
        const isDeadline = deadline === key;
        const isToday = key === today;
        const isSelected = key === selected;
        const label = [
          fullDate.format(dateFromKey(key)),
          ...reminders.map((reminder) => `${t(`types.${reminder.type}`)}: ${reminder.title}`),
          ...(isDeadline ? [tc("projectDeadline")] : []),
        ].join(", ");

        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            aria-pressed={isSelected}
            aria-current={isToday ? "date" : undefined}
            aria-label={label}
            className={cn(
              "relative flex flex-col transition-colors",
              compact
                ? "mx-auto h-11 w-full items-center justify-center rounded-md hover:bg-muted"
                : "min-h-14 items-start gap-1 bg-card p-1.5 text-left hover:bg-muted/50 sm:min-h-24 sm:p-2",
              isSelected && (compact ? "bg-primary/10 ring-1 ring-primary" : "bg-primary/10 ring-1 ring-inset ring-primary"),
            )}
          >
            {hasReminders ? (
              <span className={cn("flex min-w-0 flex-wrap items-center gap-1", compact && "justify-center")}>
                {compact ? (
                  <ReminderMarkers reminders={reminders} overflow="badge" />
                ) : (
                  <>
                    <ReminderMarkers reminders={reminders} overflow="badge" className="sm:hidden" />
                    <ReminderMarkers reminders={reminders} max={3} className="hidden sm:flex" />
                  </>
                )}
                {isDeadline && <DeadlineFlag compact={compact} />}
              </span>
            ) : (
              <span className={cn("flex min-w-0 flex-wrap items-center gap-1", compact && "justify-center")}>
                <span className={cn("grid size-6 place-items-center rounded-full tabular-nums", isToday && "bg-primary font-semibold text-primary-foreground")}>
                  {day}
                </span>
                {isDeadline && <DeadlineFlag compact={compact} />}
              </span>
            )}
            {/* Today's number is replaced by icons here, so today is marked by a dot instead of the filled number. */}
            {isToday && hasReminders && (
              <span aria-hidden="true" className="absolute top-1 right-1 size-1.5 rounded-full bg-primary" />
            )}
          </button>
        );
      })}
    </div>
  );
}

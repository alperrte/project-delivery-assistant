"use client";

import { useTranslations } from "next-intl";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ReminderTypeIcon } from "../type-config";
import type { Reminder } from "../types";

/** Same footprint as a day number (size-6), so an icon can take its place in a calendar cell. */
const ICON_SIZE = 16;
const BOX = ICON_SIZE + 8;

function Marker({ reminder }: { reminder: Reminder }) {
  const t = useTranslations("reminders");
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            role="img"
            aria-label={`${t(`types.${reminder.type}`)}: ${reminder.title}`}
            data-reminder-type={reminder.type}
            style={{ width: BOX, height: BOX }}
            className={cn(
              "inline-grid shrink-0 place-items-center rounded-full",
              reminder.scope === "PROJECT" ? "bg-primary/15 text-primary" : "bg-muted text-foreground",
            )}
          />
        }
      >
        <ReminderTypeIcon type={reminder.type} size={ICON_SIZE} />
      </TooltipTrigger>
      <TooltipContent>{reminder.title}</TooltipContent>
    </Tooltip>
  );
}

function titlesOf(reminders: Reminder[]) {
  return reminders.map((reminder) => reminder.title).join(", ");
}

/**
 * What a calendar cell shows instead of its day number when the day has reminders: the reminder's type icon.
 * One reminder is just its icon. For several, `inline` shows up to `max` icons followed by "+N" (roomy cells) and
 * `badge` shows the first icon with a "+N" count on its corner (narrow cells), so a busy day never grows its cell.
 *
 * Hovering an icon shows the title; the accessible name is "<type>: <title>", so nothing depends on the icon or its
 * colour alone. Touch users tap the day and read the titles in the day list. The icons are inert on purpose: the
 * surrounding day button owns the click.
 */
export function ReminderMarkers({
  reminders,
  max = 3,
  overflow = "inline",
  className,
}: {
  reminders: Reminder[];
  max?: number;
  overflow?: "inline" | "badge";
  className?: string;
}) {
  if (reminders.length === 0) return null;

  if (overflow === "badge") {
    const rest = reminders.slice(1);
    return (
      <span className={cn("relative inline-flex", className)}>
        <Marker reminder={reminders[0]} />
        {rest.length > 0 && (
          <Tooltip>
            <TooltipTrigger
              render={
                <span
                  role="img"
                  aria-label={titlesOf(rest)}
                  className="absolute -top-1.5 -right-2 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] leading-none font-semibold text-primary-foreground"
                />
              }
            >
              +{rest.length}
            </TooltipTrigger>
            <TooltipContent>{titlesOf(rest)}</TooltipContent>
          </Tooltip>
        )}
      </span>
    );
  }

  const shown = reminders.slice(0, max);
  const hidden = reminders.slice(max);
  return (
    <span className={cn("flex flex-wrap items-center gap-1", className)}>
      {shown.map((reminder) => <Marker key={reminder.id} reminder={reminder} />)}
      {hidden.length > 0 && (
        <Tooltip>
          <TooltipTrigger
            render={<span role="img" aria-label={titlesOf(hidden)} className="px-0.5 text-[11px] font-medium text-muted-foreground" />}
          >
            +{hidden.length}
          </TooltipTrigger>
          <TooltipContent>{titlesOf(hidden)}</TooltipContent>
        </Tooltip>
      )}
    </span>
  );
}

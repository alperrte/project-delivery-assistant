import type { Icon } from "@phosphor-icons/react";
import { Alarm, BookmarkSimple, Briefcase, ClipboardText, Package, PresentationChart, UsersThree } from "@phosphor-icons/react";
import type { ReminderType } from "./types";

/**
 * The one place that maps a reminder type to its icon. The backend only knows the enum name; labels live in the
 * `reminders.types.*` messages. Dropdown, calendar grids, the home calendar and the day list all read from here.
 */
export const reminderTypeConfig: Record<ReminderType, { icon: Icon }> = {
  MEETING: { icon: UsersThree },
  DEADLINE: { icon: Alarm },
  PRESENTATION: { icon: PresentationChart },
  REVIEW: { icon: ClipboardText },
  DELIVERY: { icon: Package },
  WORK: { icon: Briefcase },
  OTHER: { icon: BookmarkSimple },
};

export function ReminderTypeIcon({ type, size = 16, className }: { type: ReminderType; size?: number; className?: string }) {
  const { icon: TypeIcon } = reminderTypeConfig[type];
  return <TypeIcon size={size} className={className} aria-hidden="true" />;
}

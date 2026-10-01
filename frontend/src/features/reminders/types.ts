export const REMINDER_TYPES = ["MEETING", "DEADLINE", "PRESENTATION", "REVIEW", "DELIVERY", "WORK", "OTHER"] as const;
export type ReminderType = (typeof REMINDER_TYPES)[number];

/** PERSONAL: only its creator sees it. PROJECT: every project member sees it; only a Project Manager creates one. */
export type ReminderScope = "PERSONAL" | "PROJECT";

export type Reminder = {
  id: string;
  title: string;
  description: string | null;
  type: ReminderType;
  scope: ReminderScope;
  /** `YYYY-MM-DD`, a plain calendar date (never a timestamp), so it can't slide to a neighbouring day. */
  date: string;
  /** `HH:mm` or `HH:mm:ss`, absent for a date-only reminder. */
  time: string | null;
  creator: { userId: string; nickname: string | null };
};

export type ReminderInput = {
  title: string;
  description?: string;
  type: ReminderType;
  date: string;
  time?: string;
};

export type CreateReminderInput = ReminderInput & { scope: ReminderScope };

import { z } from "zod";
import { isDateKey } from "./dates";
import { REMINDER_TYPES } from "./types";

export const TITLE_MAX = 100;
export const DESCRIPTION_MAX = 500;

/**
 * Messages are keys under `reminders.validation`. A new reminder may not be dated in the past; an existing one may
 * keep its (already past) date, so its title can still be corrected.
 */
export function buildReminderSchema({ today, originalDate }: { today: string; originalDate?: string }) {
  return z
    .object({
      title: z.string().trim().min(1, "titleRequired").max(TITLE_MAX, "titleMax"),
      description: z.string().max(DESCRIPTION_MAX, "descriptionMax").optional(),
      type: z.enum(REMINDER_TYPES, { error: "typeRequired" }),
      scope: z.enum(["PERSONAL", "PROJECT"]),
      date: z.string().min(1, "dateRequired").refine(isDateKey, "dateInvalid"),
      time: z
        .string()
        .optional()
        .refine((value) => !value || /^([01]\d|2[0-3]):[0-5]\d$/.test(value), "timeInvalid"),
    })
    .superRefine((value, ctx) => {
      if (isDateKey(value.date) && value.date < today && value.date !== originalDate) {
        ctx.addIssue({ code: "custom", path: ["date"], message: "datePast" });
      }
    });
}

export type ReminderFormValues = z.infer<ReturnType<typeof buildReminderSchema>>;

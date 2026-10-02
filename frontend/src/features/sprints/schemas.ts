import { z } from "zod";

export const SPRINT_NAME_MAX = 80;
export const SPRINT_GOAL_MAX = 500;

export const sprintFormSchema = z
  .object({
    name: z.string().trim().min(1, "required").max(SPRINT_NAME_MAX, "maxLength"),
    goal: z.string().max(SPRINT_GOAL_MAX, "maxLength"),
    startDate: z.string().min(1, "required"),
    endDate: z.string().min(1, "required"),
  })
  .superRefine((values, ctx) => {
    if (values.startDate && values.endDate && values.endDate < values.startDate) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "sprintDateOrder" });
    }
  });

export type SprintFormValues = z.infer<typeof sprintFormSchema>;

export type SprintPayload = { name: string; goal: string | null; startDate: string; endDate: string };

export function toSprintPayload(values: SprintFormValues): SprintPayload {
  return {
    name: values.name.trim(),
    goal: values.goal.trim() ? values.goal.trim() : null,
    startDate: values.startDate,
    endDate: values.endDate,
  };
}

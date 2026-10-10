import { z } from "zod";

export const CRITERION_TITLE_MAX = 200;
export const CRITERION_DESCRIPTION_MAX = 2000;

export const criterionFormSchema = z.object({
  title: z.string().trim().min(1, "required").max(CRITERION_TITLE_MAX, "maxLength"),
  description: z.string().max(CRITERION_DESCRIPTION_MAX, "maxLength").optional(),
});

export type CriterionFormValues = z.infer<typeof criterionFormSchema>;

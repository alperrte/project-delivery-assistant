import { z } from "zod";

export const criterionFormSchema = z.object({
  title: z.string().trim().min(1, "required").max(200, "maxLength"),
  description: z.string().max(2000, "maxLength").optional(),
});

export type CriterionFormValues = z.infer<typeof criterionFormSchema>;

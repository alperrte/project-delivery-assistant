import { z } from "zod";

export const squadFormSchema = z.object({
  name: z.string().min(1, "required").max(120, "maxLength"),
  description: z.string().max(2000, "maxLength").optional(),
});

export type SquadFormValues = z.infer<typeof squadFormSchema>;

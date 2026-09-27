import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().min(1, "required").max(160, "maxLength"),
  description: z.string().max(2000, "maxLength").optional(),
  organizationId: z.string().uuid().optional(),
});

export type CreateProjectValues = z.infer<typeof createProjectSchema>;

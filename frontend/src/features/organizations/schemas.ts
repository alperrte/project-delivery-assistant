import { z } from "zod";

export const organizationFormSchema = z.object({
  name: z.string().min(1, "required").max(160, "maxLength"),
  description: z.string().max(2000, "maxLength").optional(),
});

export type OrganizationFormValues = z.infer<typeof organizationFormSchema>;

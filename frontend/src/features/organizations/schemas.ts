import { z } from "zod";
function websiteValid(value: string) {
  if (!value) return true;
  if (/[\u0000-\u0020\u007f]/.test(value)) return false;
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) && !!url.hostname && !url.username && !url.password; } catch { return false; }
}
export const organizationFormSchema = z.object({
  name: z.string().trim().min(1, "required").max(160, "maxLength"),
  description: z.string().max(2000, "maxLength").optional(),
  website: z.string().trim().max(2048, "maxLength").refine(websiteValid, "url").optional(),
  contactEmail: z.string().trim().max(254, "maxLength").refine(value => !value || z.email().safeParse(value).success, "email").optional(),
  notes: z.string().max(1000, "maxLength").optional(),
  location: z.string().max(200, "maxLength").optional(),
});
export type OrganizationFormValues = z.infer<typeof organizationFormSchema>;

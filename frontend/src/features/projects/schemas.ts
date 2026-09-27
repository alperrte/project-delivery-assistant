import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().min(1, "required").max(160, "maxLength"),
  description: z.string().max(2000, "maxLength").optional(),
  organizationId: z.string().uuid().optional(),
});

export type CreateProjectValues = z.infer<typeof createProjectSchema>;

export const projectStatuses = ["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED"] as const;
export const projectPriorities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export const projectSettingsSchema = z
  .object({
    name: z.string().min(1, "required").max(160, "maxLength"),
    description: z.string().max(2000, "maxLength").optional(),
    priority: z.enum(projectPriorities),
    status: z.enum(projectStatuses),
    startDate: z.string().optional(),
    targetEndDate: z.string().optional(),
    projectGoal: z.string().max(2000, "maxLength").optional(),
    techStack: z.string().max(1000, "maxLength").optional(),
    organizationId: z.string().uuid().optional(),
  })
  .refine((v) => !v.startDate || !v.targetEndDate || v.targetEndDate >= v.startDate, {
    path: ["targetEndDate"],
    message: "dateOrder",
  });

export type ProjectSettingsValues = z.infer<typeof projectSettingsSchema>;

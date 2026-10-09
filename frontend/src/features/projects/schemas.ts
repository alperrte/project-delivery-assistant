import { z } from "zod";
import { MAX_TECH_SELECTION } from "./tech-catalog";
import { PROJECT_TYPES } from "./types";

export const TAGLINE_MAX = 120;

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, "required").max(160, "maxLength"),
  tagline: z.string().max(TAGLINE_MAX, "maxLength").optional(),
  projectType: z.enum(PROJECT_TYPES, { error: "required" }),
  techStack: z.array(z.string()).max(MAX_TECH_SELECTION, "maxLength"),
  description: z.string().max(2000, "maxLength").optional(),
  organizationId: z.string().uuid().optional(),
});

export type CreateProjectValues = z.infer<typeof createProjectSchema>;

export const projectStatuses = ["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED"] as const;
export const projectPriorities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export const projectSettingsSchema = z
  .object({
    name: z.string().trim().min(1, "required").max(160, "maxLength"),
    description: z.string().max(2000, "maxLength").optional(),
    priority: z.enum(projectPriorities),
    status: z.enum(projectStatuses),
    startDate: z.string().optional(),
    targetEndDate: z.string().optional(),
    techStack: z.string().max(1000, "maxLength").optional(),
    organizationId: z.string().uuid().optional(),
    projectType: z.enum(PROJECT_TYPES),
    tagline: z.string().max(TAGLINE_MAX, "maxLength").optional(),
  })
  .refine((v) => !v.startDate || !v.targetEndDate || v.targetEndDate >= v.startDate, {
    path: ["targetEndDate"],
    message: "dateOrder",
  });

export type ProjectSettingsValues = z.infer<typeof projectSettingsSchema>;

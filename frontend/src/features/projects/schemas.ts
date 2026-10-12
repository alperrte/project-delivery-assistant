import { LOGO_SHAPES } from "@/lib/media/logo-shape";
import { z } from "zod";
import { MAX_TECH_SELECTION } from "./tech-catalog";
import { PROJECT_TYPES } from "./types";

export const TAGLINE_MAX = 120;

export const projectStatuses = ["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED"] as const;
export const projectPriorities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const taskManagementModes = ["SIMPLE", "ADVANCED", "BOTH"] as const;

/** Everything the settings page can change (except deleting) is asked here too, so a new project and an edited one never differ. */
export const createProjectSchema = z
  .object({
    logoShape: z.enum(LOGO_SHAPES),
    name: z.string().trim().min(1, "required").max(160, "maxLength"),
    tagline: z.string().max(TAGLINE_MAX, "maxLength").optional(),
    projectTypes: z.array(z.enum(PROJECT_TYPES)).min(1, "required").max(PROJECT_TYPES.length, "maxLength"),
    techStack: z.array(z.string()).max(MAX_TECH_SELECTION, "maxLength"),
    description: z.string().max(2000, "maxLength").optional(),
    organizationId: z.string().uuid().optional(),
    status: z.enum(projectStatuses),
    priority: z.enum(projectPriorities),
    startDate: z.string().optional(),
    targetEndDate: z.string().optional(),
    taskManagementMode: z.enum(taskManagementModes),
  })
  .refine((v) => !v.startDate || !v.targetEndDate || v.targetEndDate >= v.startDate, {
    path: ["targetEndDate"],
    message: "dateOrder",
  });

export type CreateProjectValues = z.infer<typeof createProjectSchema>;

export const projectSettingsSchema = z
  .object({
    logoShape: z.enum(LOGO_SHAPES),
    name: z.string().trim().min(1, "required").max(160, "maxLength"),
    description: z.string().max(2000, "maxLength").optional(),
    priority: z.enum(projectPriorities),
    status: z.enum(projectStatuses),
    startDate: z.string().optional(),
    targetEndDate: z.string().optional(),
    techStack: z.string().max(1000, "maxLength").optional(),
    organizationId: z.string().uuid().optional(),
    projectTypes: z.array(z.enum(PROJECT_TYPES)).min(1, "required").max(PROJECT_TYPES.length, "maxLength"),
    tagline: z.string().max(TAGLINE_MAX, "maxLength").optional(),
  })
  .refine((v) => !v.startDate || !v.targetEndDate || v.targetEndDate >= v.startDate, {
    path: ["targetEndDate"],
    message: "dateOrder",
  });

export type ProjectSettingsValues = z.infer<typeof projectSettingsSchema>;

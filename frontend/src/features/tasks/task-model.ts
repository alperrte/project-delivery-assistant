import type { TaskManagementMode } from "@/features/projects/types";
import type { TaskCreationMode } from "./types";

export const allowsAdvanced = (mode: TaskManagementMode | null) => mode === "ADVANCED" || mode === "BOTH";
export const allowsCreation = (policy: TaskManagementMode | null, mode: TaskCreationMode) => policy === "BOTH" || policy === mode;
export const initialCreationMode = (policy: TaskManagementMode | null, hasAdvancedContext = false): TaskCreationMode =>
  policy === "ADVANCED" || (policy === "BOTH" && hasAdvancedContext) ? "ADVANCED" : "SIMPLE";

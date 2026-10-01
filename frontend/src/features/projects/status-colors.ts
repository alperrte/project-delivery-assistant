import type { ProjectPriority, ProjectStatus } from "./types";

/**
 * Shared status/priority -> badge class mapping so the project list, org
 * list, and project detail header render the same status in the same color
 * (see .agents/frontend-design-rules.md - one accent color, semantic tokens only).
 */
export function projectStatusBadgeClass(status: ProjectStatus): string {
  switch (status) {
    case "ACTIVE":
    case "COMPLETED":
      return "border border-success/25 bg-success/10 text-success";
    case "ON_HOLD":
      return "border border-warning/25 bg-warning/10 text-warning";
    case "ARCHIVED":
      return "border border-border bg-muted text-muted-foreground";
    case "PLANNING":
    default:
      return "border border-primary/25 bg-primary/10 text-primary";
  }
}

export function projectPriorityBadgeClass(priority: ProjectPriority): string {
  switch (priority) {
    case "CRITICAL":
      return "border border-destructive/25 bg-destructive/10 text-destructive";
    case "HIGH":
      return "border border-warning/25 bg-warning/10 text-warning";
    case "MEDIUM":
      return "border border-primary/25 bg-primary/10 text-primary";
    case "LOW":
    default:
      return "border border-border bg-muted text-muted-foreground";
  }
}

/** Header-band tone of a project/workspace card for a given status. */
export function projectStatusTone(status: ProjectStatus): "neutral" | "success" | "warning" {
  switch (status) {
    case "ACTIVE":
    case "COMPLETED":
      return "success";
    case "ON_HOLD":
      return "warning";
    case "ARCHIVED":
    case "PLANNING":
    default:
      return "neutral";
  }
}

/** Same semantics as projectStatusBadgeClass, as a plain dot fill for dense table rows. */
export function projectStatusDotClass(status: ProjectStatus): string {
  switch (status) {
    case "ACTIVE":
    case "COMPLETED":
      return "bg-success";
    case "ON_HOLD":
      return "bg-warning";
    case "ARCHIVED":
      return "bg-muted-foreground/40";
    case "PLANNING":
    default:
      return "bg-primary";
  }
}

/** Same semantics as projectPriorityBadgeClass, as a plain dot fill for dense table rows. */
export function projectPriorityDotClass(priority: ProjectPriority): string {
  switch (priority) {
    case "CRITICAL":
      return "bg-destructive";
    case "HIGH":
      return "bg-warning";
    case "MEDIUM":
      return "bg-primary";
    case "LOW":
    default:
      return "bg-muted-foreground/40";
  }
}

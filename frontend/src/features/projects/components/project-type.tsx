import type { Icon } from "@phosphor-icons/react";
import { Brain, Cube, DeviceMobile, Desktop, Globe } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { ProjectType } from "../types";

export const PROJECT_TYPE_ICONS: Record<ProjectType, Icon> = {
  WEB: Globe,
  MOBILE: DeviceMobile,
  AI: Brain,
  DESKTOP: Desktop,
  OTHER: Cube,
};

/** Neutral type badge (icon + name). Colour is reserved for status, so type never competes with it. */
export function ProjectTypeBadge({ type, label, className }: { type: ProjectType; label: string; className?: string }) {
  const TypeIcon = PROJECT_TYPE_ICONS[type];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-foreground ring-1 ring-border", className)}>
      <TypeIcon size={14} aria-hidden="true" />
      {label}
    </span>
  );
}

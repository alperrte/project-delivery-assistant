"use client";

import { Brain, BracketsCurly, ChartLine, Code, Crown, Flask, Palette, Stack } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { ProjectRole } from "./types";

export const PROJECT_ROLE_ICONS = {
  PROJECT_MANAGER: Crown,
  BACKEND_DEVELOPER: BracketsCurly,
  FRONTEND_DEVELOPER: Code,
  FULL_STACK_DEVELOPER: Stack,
  AI_ML_DEVELOPER: Brain,
  UI_UX_DEVELOPER: Palette,
  TESTER: Flask,
  ANALYST: ChartLine,
} satisfies Record<ProjectRole, typeof Crown>;

export function ProjectRoleLabel({ role }: { role: ProjectRole }) {
  const t = useTranslations("roles");
  const Icon = PROJECT_ROLE_ICONS[role];
  return <span className="inline-flex min-w-0 max-w-full items-center gap-1.5"><Icon size={15} className="shrink-0" aria-hidden="true" /><span className="min-w-0 break-words">{t(role)}</span></span>;
}

export function ProjectRoleBadge({ role }: { role: ProjectRole }) {
  return <Badge variant={role === "PROJECT_MANAGER" ? "default" : "secondary"} className="h-auto min-h-5 max-w-full whitespace-normal"><ProjectRoleLabel role={role} /></Badge>;
}

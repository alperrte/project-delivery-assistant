import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The one place page-level content width is decided. `AppShell` already caps every page at its own max width, so
 * pages never pick a `max-w-*` themselves:
 * - `wide`: lists, boards, dashboards and tables; use the full shell width.
 * - `form`: settings and create/edit pages; wide enough for two columns of fields, never a full-width form.
 * - `narrow`: single-purpose cards such as accepting an invitation.
 */
const WIDTHS = {
  wide: "",
  form: "max-w-5xl",
  narrow: "max-w-xl",
} as const;

export function PageContainer({
  width = "wide",
  className,
  children,
}: {
  width?: keyof typeof WIDTHS;
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("min-w-0", WIDTHS[width], className)}>{children}</div>;
}

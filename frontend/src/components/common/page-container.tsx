import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The one place page-level content width is decided. `AppShell` already caps every page at its own max width, so
 * pages never pick a `max-w-*` themselves:
 * - `wide`: lists, boards, dashboards and tables; use the full shell width.
 * - `form`: settings and create/edit pages; wide enough for two columns of fields, never a full-width form.
 * - `narrow`: single-purpose cards such as accepting an invitation.
 * - `centered`: single-column create/edit pages (invite a member, sprint, criterion). The whole page column (back link,
 *   header, fields, error summary and sticky actions) is centred in the shell's content area, so it follows the main
 *   region next to the sidebar and never the viewport; on narrow screens it is simply full width.
 */
const WIDTHS = {
  wide: "",
  form: "max-w-5xl",
  narrow: "max-w-xl",
  centered: "mx-auto w-full max-w-2xl",
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

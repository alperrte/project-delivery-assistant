import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Task } from "../../types";
import type { TaskPermissions } from "../../permissions";

/** What every part of the detail page needs; the page resolves it once. */
export type DetailContext = {
  task: Task;
  slug: string;
  projectId: string;
  userId: string;
  isManager: boolean;
  perms: TaskPermissions;
};

/**
 * `ConfirmDialog` awaits `onConfirm`. A failed mutation has already been reported by `useTaskMutation`, so the
 * rejection is swallowed here instead of surfacing as an unhandled promise.
 */
export const settle = (): void => undefined;

/** A titled block of the main column: a heading with an optional count and action, then the body. */
export function DetailSection({
  id,
  title,
  count,
  action,
  children,
  className,
}: {
  id: string;
  title: string;
  count?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={id} className={cn("space-y-3", className)}>
      <div className="flex min-h-7 items-center justify-between gap-3">
        <h2 id={id} className="flex items-baseline gap-2 text-sm font-semibold text-foreground">
          {title}
          {count && <span className="text-xs font-normal text-muted-foreground tabular-nums">{count}</span>}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** One labelled row of the side panel. */
export function PropertyRow({ label, children, htmlFor }: { label: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-3 py-2.5">
      <dt className="pt-0.5 text-xs font-medium text-muted-foreground">
        {htmlFor ? <label htmlFor={htmlFor}>{label}</label> : label}
      </dt>
      <dd className="min-w-0 text-sm text-foreground">{children}</dd>
    </div>
  );
}

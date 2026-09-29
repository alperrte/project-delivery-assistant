import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({ title, description, action, className }: { title: string; description?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border bg-card px-6 py-12 shadow-sm sm:px-10 sm:py-14", className)}>
      <div className="mb-6 h-1 w-10 rounded-full bg-primary" aria-hidden="true" />
      <h2 className="font-heading text-xl font-semibold text-foreground">{title}</h2>
      {description && <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

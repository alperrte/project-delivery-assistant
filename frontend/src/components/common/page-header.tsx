import type { ReactNode } from "react";

export function PageHeader({ title, description, action, titleAdornment }: { title: string; description?: string; action?: ReactNode; titleAdornment?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-1.5">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}{titleAdornment && <span className="ml-2 inline-flex align-middle">{titleAdornment}</span>}</h1>
        {description && <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

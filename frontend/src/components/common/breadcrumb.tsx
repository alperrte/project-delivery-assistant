import type { ReactNode } from "react";
import Link from "@/i18n/navigation";
import { CaretRight } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";

export type Crumb = {
  label: ReactNode;
  /** Logical (unprefixed) path. The last crumb is the current page and never links. */
  href?: string;
  /** Full name when `label` is shortened, e.g. a task key. */
  title?: string;
};

const linkClass = "inline-flex min-h-6 max-w-48 items-center truncate rounded-sm hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** The path from a section down to the current page. The last item is the page itself. */
export function Breadcrumb({ label, items, className }: { label: string; items: Crumb[]; className?: string }) {
  return (
    <nav aria-label={label} className={cn("min-w-0 text-sm text-muted-foreground", className)}>
      <ol className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${index}-${item.href ?? "current"}`} className="flex min-w-0 items-center gap-1.5">
              {index > 0 && <CaretRight size={10} aria-hidden="true" className="shrink-0" />}
              {last || !item.href
                ? <span aria-current={last ? "page" : undefined} title={item.title} className={cn("min-w-0 max-w-64 truncate", last && "font-medium text-foreground")}>{item.label}</span>
                : <Link href={item.href} title={item.title} className={linkClass}>{item.label}</Link>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

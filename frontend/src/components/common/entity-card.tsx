import type { ReactNode } from "react";
import Link from "@/i18n/navigation";
import { ArrowRight } from "@phosphor-icons/react";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type EntityTone = "neutral" | "success" | "warning" | "danger";

/** Tinted header band + mark tile per tone; semantic tokens only, so both themes follow. */
const TONES: Record<EntityTone, { band: string; mark: string }> = {
  neutral: { band: "bg-muted", mark: "bg-card text-foreground ring-1 ring-border" },
  success: { band: "bg-success/10", mark: "bg-success/15 text-success" },
  warning: { band: "bg-warning/10", mark: "bg-warning/15 text-warning" },
  danger: { band: "bg-destructive/10", mark: "bg-destructive/15 text-destructive" },
};

type EntityCardProps = {
  tone?: EntityTone;
  /** Optional cover image drawn behind the header band's content; the band itself stays where it is. */
  banner?: ReactNode;
  /** Optional control pinned to the card's top-right corner, above the card-wide link. */
  corner?: ReactNode;
  /** Letter or icon shown in the header tile. */
  mark: ReactNode;
  title: string;
  description: string;
  /** Status pill under the description. */
  badge?: ReactNode;
  /** Body sections (use EntityCardSection) and the footer. */
  children?: ReactNode;
  className?: string;
};

export function EntityCard({ tone = "neutral", banner, corner, mark, title, description, badge, children, className }: EntityCardProps) {
  const palette = TONES[tone];
  return (
    <article
      className={cn(
        "group relative flex w-full min-w-0 flex-col rounded-xl border bg-card p-2 transition-[border-color,box-shadow,transform] duration-200",
        "hover:border-border-strong hover:shadow-sm motion-safe:hover:-translate-y-0.5",
        "has-[a:focus-visible]:border-ring has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring/40",
        className,
      )}
    >
      {corner && <div className="absolute top-4 right-4 z-10">{corner}</div>}
      <div className={cn("relative overflow-hidden rounded-lg px-4 py-5 text-center", palette.band)}>
        {banner && (
          <>
            <div aria-hidden="true" className="absolute inset-0">{banner}</div>
            {/* A veil keeps the name and description readable on any picture. */}
            <div aria-hidden="true" className="absolute inset-0 bg-background/50" />
          </>
        )}
        <span
          aria-hidden="true"
          className={cn("relative mx-auto grid size-12 place-items-center rounded-lg font-heading text-xl font-semibold", palette.mark)}
        >
          {mark}
        </span>
        <h2 className="relative mt-3 truncate text-base font-semibold text-foreground" title={title}>{title}</h2>
        <p className="relative mx-auto mt-1 line-clamp-2 min-h-10 max-w-[34ch] text-sm leading-5 text-muted-foreground">{description}</p>
        {badge && <div className="relative mt-3 flex justify-center">{badge}</div>}
      </div>
      <div className="flex flex-1 flex-col gap-3 px-2 pt-3 pb-1">{children}</div>
    </article>
  );
}

export function EntityCardSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="border-t pt-3">
      <h3 className="mb-2 text-xs font-medium text-muted-foreground">{label}</h3>
      {children}
    </section>
  );
}

/** Footer link. Its ::after stretches over the whole card, so the card is one link target. */
export function EntityCardLink({ href, label, ariaLabel, className }: { href: string; label: string; ariaLabel?: string; className?: string }) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className={cn(
        buttonVariants({ variant: "outline", size: "lg" }),
        "min-w-0 flex-1 justify-between px-3 after:absolute after:inset-0 after:rounded-xl after:content-['']",
        className,
      )}
    >
      {label}
      <ArrowRight size={16} aria-hidden="true" />
    </Link>
  );
}

/** Pins the footer to the card bottom so links line up across a row. Extra controls need `relative z-10` to sit above the stretched link. */
export function EntityCardFooter({ children }: { children: ReactNode }) {
  return <div className="mt-auto flex items-center gap-1.5 pt-1">{children}</div>;
}

/** Status pill: dot + label, coloured by the caller's token classes. */
export function EntityStatusPill({ className, dotClassName, label }: { className: string; dotClassName: string; label: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", className)}>
      <span className={cn("size-1.5 shrink-0 rounded-full", dotClassName)} aria-hidden="true" />
      {label}
    </span>
  );
}

export function EntityGrid({ children }: { children: ReactNode }) {
  return <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</ul>;
}

/** Loading placeholder with the EntityCard footprint (header band + sections + footer); shared by every card grid. */
export function EntityCardSkeleton() {
  return (
    <div className="w-full rounded-xl border bg-card p-2" aria-hidden="true">
      <Skeleton className="h-36 w-full rounded-lg" />
      <div className="space-y-4 px-2 pt-4 pb-2">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-9 w-full" />
      </div>
    </div>
  );
}

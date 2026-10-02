import type { ReactNode } from "react";

/** One block of a settings page: what it is on the left, its controls on the right; stacks on small screens. */
export function SettingsSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="grid gap-5 border-t py-8 first:border-t-0 first:pt-0 md:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] md:gap-12 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="mt-1.5 text-sm leading-5 text-muted-foreground">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

import type { ReactNode } from "react";

/** Entrance motion lives in the (auth) template, so the card itself is static. */
export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-7">
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

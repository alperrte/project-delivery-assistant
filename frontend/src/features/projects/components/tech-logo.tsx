/* eslint-disable @next/next/no-img-element -- tiny local SVGs and an authenticated API image; next/image optimisation does not apply. */
import { cn } from "@/lib/utils";
import { resolveTech, type TechItem } from "../tech-catalog";

/** Catalog logo; technologies without a file fall back to their first letter. Decorative: the name is announced elsewhere. */
export function TechLogo({ tech, className }: { tech: TechItem; className?: string }) {
  if (!tech.icon) {
    return (
      <span aria-hidden="true" className={cn("grid size-5 place-items-center font-heading text-xs font-semibold text-foreground", className)}>
        {tech.name.slice(0, 1)}
      </span>
    );
  }
  return (
    <img
      src={tech.icon}
      alt=""
      width={20}
      height={20}
      loading="lazy"
      decoding="async"
      className={cn("size-5 shrink-0 object-contain", tech.mono && "dark:invert", className)}
    />
  );
}

export type TechLabel = { label: string; tech: TechItem | null };

/** Splits stored labels into catalog entries (logo) and free text from older projects (text chip). */
export function toTechLabels(labels: string[]): TechLabel[] {
  return labels.map((label) => ({ label, tech: resolveTech(label) }));
}

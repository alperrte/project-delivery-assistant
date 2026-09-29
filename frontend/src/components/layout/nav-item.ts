import { cn } from "@/lib/utils";

/**
 * Shared active/hover treatment for a sidebar row: a filled background plus a
 * short rounded bar on the left edge, so the current section reads at a
 * glance among icon-only rows too. Callers still own their own layout
 * classes (padding, gap, font size) — this only supplies the semantic state.
 */
export function navItemClass(active: boolean, className?: string) {
  return cn(
    "relative text-muted-foreground transition-colors",
    active &&
      "bg-accent font-semibold text-foreground before:absolute before:top-1/2 before:left-0 before:h-4 before:w-[3px] before:-translate-y-1/2 before:rounded-full before:bg-primary",
    className,
  );
}

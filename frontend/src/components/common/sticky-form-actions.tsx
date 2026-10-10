import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Sticky bottom action bar shared by full-page forms. `data-sticky-actions` lets the chat dock lift above it
 * (see the messaging panel rules); a bar without it would be covered by the docked chat.
 */
export function StickyFormActions({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      data-sticky-actions
      className={cn(
        "sticky bottom-0 z-20 -mx-4 -mb-6 mt-10 border-t bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:-mx-8 sm:-mb-8 sm:px-8",
        className,
      )}
    >
      {children}
    </div>
  );
}

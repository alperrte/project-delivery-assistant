"use client";

import type { ReactNode } from "react";
import { CircleNotch } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Primary form action. Stays disabled while pending, which also blocks duplicate submits. */
export function SubmitButton({
  pending,
  children,
  className,
}: {
  pending: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={cn(
        "h-11 w-full gap-2 rounded-lg text-sm font-medium transition-[background-color,transform] duration-200 hover:bg-primary/90 active:scale-[0.99]",
        className,
      )}
    >
      {pending && <CircleNotch size={16} className="animate-spin" />}
      {children}
    </Button>
  );
}

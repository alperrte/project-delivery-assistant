"use client";

import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

export type Option<T extends string> = { value: T; label: string; icon?: ReactNode };

/** A short list of mutually exclusive choices, each a whole clickable row. */
export function OptionGroup<T extends string>({
  name,
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  name: string;
  /** Accessible name of the group. */
  label: string;
  value: T;
  onChange: (next: T) => void;
  options: readonly Option<T>[];
  disabled?: boolean;
}) {
  return (
    <RadioGroup
      value={value}
      onValueChange={(next) => onChange(next as T)}
      aria-label={label}
      disabled={disabled}
      className="gap-2 sm:grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))]"
    >
      {options.map((option) => {
        const id = `${name}-${option.value}`;
        return (
          <Label
            key={option.value}
            htmlFor={id}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-md border px-3 py-2.5 text-sm font-normal has-[[data-checked]]:border-primary has-[[data-checked]]:bg-primary/5",
              disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-muted/50",
            )}
          >
            <RadioGroupItem id={id} value={option.value} />
            {option.icon}
            {option.label}
          </Label>
        );
      })}
    </RadioGroup>
  );
}

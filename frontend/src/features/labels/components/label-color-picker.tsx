"use client";

import { useTranslations } from "next-intl";
import { Check } from "@phosphor-icons/react";
import { LABEL_COLORS, type LabelColor } from "@/features/tasks/types";
import { labelDotClass } from "@/features/tasks/workflow";
import { cn } from "@/lib/utils";

/**
 * The nine label tokens as a radio group. Native radio inputs give arrow key navigation and a single tab stop for free;
 * the swatch is the visible face of each one, so a color is never stored as a hex, only as a token name.
 */
export function LabelColorPicker({ value, onChange, name, label, disabled }: { value: LabelColor; onChange: (color: LabelColor) => void; name: string; label: string; disabled?: boolean }) {
  const t = useTranslations("labels.colors");

  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {LABEL_COLORS.map((color) => (
        <label key={color} className="relative cursor-pointer has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
          <input type="radio" name={name} value={color} checked={value === color} disabled={disabled} onChange={() => onChange(color)} className="peer sr-only" />
          <span
            className={cn(
              "flex size-7 items-center justify-center rounded-full text-background ring-offset-2 ring-offset-background transition-shadow peer-checked:ring-2 peer-checked:ring-foreground peer-focus-visible:ring-3 peer-focus-visible:ring-ring",
              labelDotClass(color),
            )}
          >
            {value === color && <Check size={14} weight="bold" aria-hidden="true" />}
          </span>
          <span className="sr-only">{t(color)}</span>
        </label>
      ))}
    </div>
  );
}

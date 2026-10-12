"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { Check } from "@phosphor-icons/react";
import { LOGO_SHAPES, type LogoShape } from "@/lib/media/logo-shape";
import { cn } from "@/lib/utils";
import { EntityMark } from "./entity-mark";

/** Native radios provide arrow-key navigation and a single tab stop without custom keyboard handling. */
export function LogoShapePicker({ value, onChange, name, src, disabled = false }: {
  value: LogoShape; onChange: (shape: LogoShape) => void;
  name: string; src: string | null; disabled?: boolean;
}) {
  const t = useTranslations("logoShape");
  const id = useId();
  return <fieldset disabled={disabled} className="space-y-2">
    <legend className="mb-2 text-sm font-medium">{t("label")}</legend>
    <div className="grid grid-cols-2 gap-2">
      {LOGO_SHAPES.map(shape => <label key={shape} className={cn(
        "relative flex min-h-16 min-w-0 cursor-pointer items-center gap-3 rounded-lg border bg-background p-3 transition-colors hover:bg-muted has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
        value === shape ? "border-primary bg-primary/5" : "border-border",
        disabled && "pointer-events-none opacity-60",
      )}>
        <input type="radio" className="absolute inset-0 z-10 size-full cursor-pointer opacity-0" name={`${id}-shape`} value={shape} checked={value === shape} onChange={() => onChange(shape)} />
        <span data-logo-frame aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-lg border bg-muted text-sm font-semibold">
          <EntityMark name={name} src={src} shape={shape} />
        </span>
        <span className="min-w-0 flex-1 break-words text-sm font-medium">{t(shape)}</span>
        {value === shape && <Check size={16} className="shrink-0 text-primary" aria-hidden="true" />}
      </label>)}
    </div>
    <p className="text-xs leading-5 text-muted-foreground">{t("hint")}</p>
  </fieldset>;
}

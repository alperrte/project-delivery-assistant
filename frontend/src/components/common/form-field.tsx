"use client";

import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Eye, EyeSlash } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FieldProps = ComponentProps<"input"> & {
  label: string;
  error?: string;
  hint?: string;
  /** Renders a show/hide toggle; the input type is controlled internally. */
  password?: boolean;
  /** Decorative leading icon inside the input. */
  icon?: ReactNode;
  /** Keeps the label for assistive tech only, when the icon and placeholder carry it visually. */
  hideLabel?: boolean;
};

export function FormField({ label, error, hint, password, icon, hideLabel, className, ...props }: FieldProps) {
  const t = useTranslations("common");
  const id = useId();
  const [visible, setVisible] = useState(false);
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className={cn(hideLabel && "sr-only")}>
        {label}
      </Label>
      <div className="relative">
        {icon && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 grid w-11 place-items-center text-muted-foreground"
          >
            {icon}
          </span>
        )}
        <Input
          id={id}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          {...props}
          type={password ? (visible ? "text" : "password") : props.type}
          className={cn("h-11 rounded-lg bg-card px-3.5 text-sm transition-[border-color,box-shadow] duration-200 hover:border-ring/50 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/20 dark:bg-input/30", icon && "pl-11", password && "pr-11", className)}
        />
        {password && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? t("hidePassword") : t("showPassword")}
            className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-muted-foreground opacity-70 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {visible ? <EyeSlash size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

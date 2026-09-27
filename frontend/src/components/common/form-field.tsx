"use client";

import { useId, useState, type ComponentProps } from "react";
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
};

export function FormField({ label, error, hint, password, className, ...props }: FieldProps) {
  const t = useTranslations("login");
  const id = useId();
  const [visible, setVisible] = useState(false);
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          {...props}
          type={password ? (visible ? "text" : "password") : props.type}
          className={cn("h-11 px-3.5", password && "pr-11", className)}
        />
        {password && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? t("hidePassword") : t("showPassword")}
            className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted-foreground transition-colors hover:text-foreground"
          >
            {visible ? <EyeSlash size={20} /> : <Eye size={20} />}
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

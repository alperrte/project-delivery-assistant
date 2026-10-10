"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SubmitButton } from "@/components/common/submit-button";
import { FormField } from "@/components/common/form-field";
import { ApiError } from "@/lib/api/client";
import { errorKey } from "@/lib/api/error-message";
import { authCtaClass } from "@/features/auth/components/auth-card";
import { useShake } from "@/features/auth/components/use-shake";
import { adminAppCodeSchema, adminBackupCodeSchema, normalizeAppCode, type AdminCodeValues } from "../schemas";

/**
 * One code field with its submit button, for the enrollment (first authenticator code) and the sign-in (authenticator
 * code or one backup code). Errors are announced in a `role="alert"`; after a refused code the field takes focus back.
 */
export function AdminCodeForm({
  backup = false,
  label,
  placeholder,
  submitLabel,
  submittingLabel,
  autoFocus,
  onSubmit,
  onExpired,
}: {
  backup?: boolean;
  label: string;
  placeholder?: string;
  submitLabel: string;
  submittingLabel: string;
  autoFocus?: boolean;
  /** Receives the normalized code; a rejection is shown as the form error. */
  onSubmit: (code: string) => Promise<void>;
  /** The single-use ticket ran out (or was used): the password has to be entered again. */
  onExpired: () => void;
}) {
  const tv = useTranslations("validation");
  const te = useTranslations("errors");
  const [formError, setFormError] = useState<string | null>(null);
  const [scope, shake] = useShake<HTMLFormElement>();
  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<AdminCodeValues>({
    resolver: zodResolver(backup ? adminBackupCodeSchema : adminAppCodeSchema),
    defaultValues: { code: "" },
  });

  // A refused code is retyped in the same place: focus returns once the field is enabled again.
  useEffect(() => {
    if (!isSubmitting && formError) setFocus("code");
  }, [isSubmitting, formError, setFocus]);

  async function submit({ code }: AdminCodeValues) {
    setFormError(null);
    try {
      await onSubmit(backup ? code.trim() : normalizeAppCode(code));
    } catch (err) {
      if (err instanceof ApiError && err.code === "two_factor_session_expired") {
        onExpired();
        return;
      }
      setFormError(te(errorKey(err)));
      shake();
    }
  }

  return (
    <form ref={scope} onSubmit={handleSubmit(submit)} noValidate>
      <fieldset disabled={isSubmitting} className="min-w-0 space-y-4">
        <FormField
          label={label}
          placeholder={placeholder}
          inputMode={backup ? "text" : "numeric"}
          autoComplete="one-time-code"
          autoFocus={autoFocus}
          spellCheck={false}
          autoCapitalize="none"
          maxLength={backup ? 32 : 12}
          className="h-14 text-center font-mono text-2xl tracking-[0.3em] tabular-nums md:text-2xl"
          error={errors.code && tv(errors.code.message!)}
          {...register("code")}
        />

        {formError && (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        )}

        <SubmitButton pending={isSubmitting} className={authCtaClass}>
          {isSubmitting ? submittingLabel : submitLabel}
        </SubmitButton>
      </fieldset>
    </form>
  );
}

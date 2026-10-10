"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft } from "@phosphor-icons/react";
import { SubmitButton } from "@/components/common/submit-button";
import { FormField } from "@/components/common/form-field";
import { ApiError } from "@/lib/api/client";
import { errorKey } from "@/lib/api/error-message";
import { authApi } from "../api";
import { secondFactorSchema, type SecondFactorValues } from "../schemas";
import { authCtaClass } from "./auth-card";
import { useCompleteLogin } from "./use-complete-login";
import { useShake } from "./use-shake";

/**
 * Second step of a sign-in on an account with two-step verification: the password was right, the server holds a
 * short-lived ticket cookie, and only a current authenticator code (or one unused backup code) opens the session.
 */
export function TwoFactorLoginForm({
  backup,
  onToggleBackup,
  onBack,
  onExpired,
}: {
  backup: boolean;
  onToggleBackup: () => void;
  onBack: () => void;
  /** The 5-minute ticket ran out: the password has to be entered again. */
  onExpired: () => void;
}) {
  const t = useTranslations("login");
  const tv = useTranslations("validation");
  const te = useTranslations("errors");
  const completeLogin = useCompleteLogin();
  const [formError, setFormError] = useState<string | null>(null);
  const [scope, shake] = useShake<HTMLFormElement>();

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<SecondFactorValues>({
    resolver: zodResolver(secondFactorSchema),
    defaultValues: { code: "" },
  });

  async function onSubmit({ code }: SecondFactorValues) {
    setFormError(null);
    try {
      await authApi.login2fa({ code });
      await completeLogin();
    } catch (err) {
      if (err instanceof ApiError && err.code === "two_factor_session_expired") {
        onExpired();
        return;
      }
      setFormError(te(errorKey(err)));
      shake();
    }
  }

  function toggle() {
    reset({ code: "" });
    setFormError(null);
    onToggleBackup();
  }

  return (
    <div>
      <form ref={scope} onSubmit={handleSubmit(onSubmit)} noValidate>
        <fieldset disabled={isSubmitting} className="min-w-0 space-y-4">
          <FormField
            key={backup ? "backup" : "app"}
            label={backup ? t("backupCode") : t("twoFactorCode")}
            placeholder={backup ? t("backupCodePlaceholder") : "123456"}
            inputMode={backup ? "text" : "numeric"}
            autoComplete="one-time-code"
            autoFocus
            spellCheck={false}
            maxLength={backup ? 32 : 6}
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
            {isSubmitting ? t("twoFactorSubmitting") : t("twoFactorSubmit")}
          </SubmitButton>
        </fieldset>
      </form>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-9 items-center gap-2 rounded-sm text-(--auth-muted) underline-offset-4 outline-none transition-colors hover:text-(--auth-ink) hover:underline focus-visible:ring-2 focus-visible:ring-(--glow)"
        >
          <ArrowLeft aria-hidden size={16} />
          {t("twoFactorBack")}
        </button>
        <button
          type="button"
          onClick={toggle}
          className="inline-flex min-h-9 items-center rounded-sm font-medium text-(--auth-link) underline-offset-4 outline-none transition-colors hover:text-(--auth-link-hover) hover:underline focus-visible:ring-2 focus-visible:ring-(--glow)"
        >
          {backup ? t("useAppCode") : t("useBackupCode")}
        </button>
      </div>
    </div>
  );
}

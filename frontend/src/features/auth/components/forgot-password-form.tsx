"use client";

import { useState } from "react";
import Link from "@/i18n/navigation";
import { useRouter } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AuthCard, authCtaClass } from "./auth-card";
import { CodeEntryStep } from "./code-entry-step";
import { PasswordRules } from "./password-rules";
import { SubmitButton } from "@/components/common/submit-button";
import { FormField } from "@/components/common/form-field";
import { ApiError } from "@/lib/api/client";
import { errorKey } from "@/lib/api/error-message";
import { authApi } from "../api";
import { forgotPasswordSchema, resetPasswordSchema, type ForgotPasswordValues, type ResetPasswordValues } from "../schemas";
import { useShake } from "./use-shake";

/**
 * Three steps: the email address, the mailed code (verifying it hands the browser a short-lived HttpOnly ticket),
 * then the new password. The backend never reveals whether the address has an account, so step one always advances.
 * Once the password is set the user signs in again; nothing here opens a session.
 */
export function ForgotPasswordForm() {
  const t = useTranslations("forgotPassword");
  const tv = useTranslations("validation");
  const te = useTranslations("errors");
  const locale = useLocale();
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code" | "password">("email");
  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [scope, shake] = useShake<HTMLFormElement>();

  const emailForm = useForm<ForgotPasswordValues>({ resolver: zodResolver(forgotPasswordSchema) });
  const resetForm = useForm<ResetPasswordValues>({ resolver: zodResolver(resetPasswordSchema) });
  const newPassword = useWatch({ control: resetForm.control, name: "newPassword" }) ?? "";

  async function onRequestCode(values: ForgotPasswordValues) {
    setFormError(null);
    try {
      await authApi.forgotPassword({ ...values, locale });
      setEmail(values.email);
      setStep("code");
    } catch (err) {
      setFormError(te(errorKey(err)));
      shake();
    }
  }

  async function onVerify(code: string) {
    await authApi.verifyResetCode({ email, code });
    setFormError(null);
    setStep("password");
  }

  async function onReset(values: ResetPasswordValues) {
    setFormError(null);
    try {
      await authApi.resetPassword(values);
      toast.success(t("success"));
      router.replace("/login");
    } catch (err) {
      // The 10-minute ticket is gone (or was never set): the code has to be requested again.
      if (err instanceof ApiError && err.code === "reset_ticket_invalid") {
        setFormError(te(errorKey(err)));
        resetForm.reset();
        setStep("email");
        return;
      }
      setFormError(te(errorKey(err)));
      shake();
    }
  }

  const backToLogin = (
    <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
      {t("backToLogin")}
    </Link>
  );

  if (step === "email") {
    return (
      <AuthCard title={t("title")} subtitle={t("subtitle")}>
        <form ref={scope} onSubmit={emailForm.handleSubmit(onRequestCode)} noValidate>
          <fieldset disabled={emailForm.formState.isSubmitting} className="min-w-0 space-y-4">
            <FormField
              label={t("email")}
              placeholder={t("emailPlaceholder")}
              type="email"
              autoComplete="email"
              error={emailForm.formState.errors.email && tv(emailForm.formState.errors.email.message!)}
              {...emailForm.register("email")}
            />

            {formError && (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            )}

            <SubmitButton pending={emailForm.formState.isSubmitting} className={authCtaClass}>
              {emailForm.formState.isSubmitting ? t("sending") : t("sendCode")}
            </SubmitButton>
          </fieldset>
        </form>

        <p className="mt-8 text-center text-sm text-muted-foreground">{backToLogin}</p>
      </AuthCard>
    );
  }

  if (step === "code") {
    return (
      <AuthCard title={t("codeSentTitle")} subtitle={t("codeSentSubtitle", { email })}>
        <CodeEntryStep
          onVerify={onVerify}
          onResend={() => authApi.forgotPassword({ email, locale })}
          submitLabel={t("verify")}
          submittingLabel={t("verifying")}
          ctaClassName={authCtaClass}
        />
        <div className="mt-6 flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={() => setStep("email")}
            className="font-medium text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
          >
            {t("changeEmail")}
          </button>
          {backToLogin}
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t("passwordTitle")} subtitle={t("passwordSubtitle")}>
      <form ref={scope} onSubmit={resetForm.handleSubmit(onReset)} noValidate>
        <fieldset disabled={resetForm.formState.isSubmitting} className="min-w-0 space-y-4">
          <FormField
            label={t("newPassword")}
            placeholder={t("newPasswordPlaceholder")}
            password
            autoComplete="new-password"
            autoFocus
            error={resetForm.formState.errors.newPassword && tv(resetForm.formState.errors.newPassword.message!)}
            {...resetForm.register("newPassword")}
          />
          <PasswordRules value={newPassword} />
          <FormField
            label={t("confirmPassword")}
            placeholder={t("confirmPasswordPlaceholder")}
            password
            autoComplete="new-password"
            error={resetForm.formState.errors.confirmPassword && tv(resetForm.formState.errors.confirmPassword.message!)}
            {...resetForm.register("confirmPassword")}
          />

          {formError && (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          )}

          <SubmitButton pending={resetForm.formState.isSubmitting} className={authCtaClass}>
            {resetForm.formState.isSubmitting ? t("resetting") : t("reset")}
          </SubmitButton>
        </fieldset>
      </form>
    </AuthCard>
  );
}

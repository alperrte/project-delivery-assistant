"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AuthCard, authCtaClass } from "./auth-card";
import { SubmitButton } from "@/components/common/submit-button";
import { FormField } from "@/components/common/form-field";
import { errorKey } from "@/lib/api/error-message";
import { authApi } from "../api";
import { forgotPasswordSchema, resetPasswordSchema, type ForgotPasswordValues, type ResetPasswordValues } from "../schemas";
import { useShake } from "./use-shake";

/**
 * Two-step flow: request a code by email, then submit the code with a new
 * password. The backend never reveals whether the email exists, so step one
 * always advances on success; only network/mail-down errors stay on step one.
 */
export function ForgotPasswordForm() {
  const t = useTranslations("forgotPassword");
  const tv = useTranslations("validation");
  const te = useTranslations("errors");
  const router = useRouter();
  const [step, setStep] = useState<"email" | "sent">("email");
  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [scope, shake] = useShake<HTMLFormElement>();

  const emailForm = useForm<ForgotPasswordValues>({ resolver: zodResolver(forgotPasswordSchema) });
  const resetForm = useForm<ResetPasswordValues>({ resolver: zodResolver(resetPasswordSchema) });

  async function onRequestCode(values: ForgotPasswordValues) {
    setFormError(null);
    try {
      await authApi.forgotPassword(values);
      setEmail(values.email);
      setStep("sent");
    } catch (err) {
      setFormError(te(errorKey(err)));
      shake();
    }
  }

  async function onReset(values: ResetPasswordValues) {
    setFormError(null);
    try {
      await authApi.resetPassword({ email, ...values });
      toast.success(t("success"));
      router.replace("/login");
    } catch (err) {
      setFormError(te(errorKey(err)));
      shake();
    }
  }

  async function onResend() {
    setIsResending(true);
    try {
      await authApi.forgotPassword({ email });
      toast.success(t("resent"));
    } catch (err) {
      toast.error(te(errorKey(err)));
    } finally {
      setIsResending(false);
    }
  }

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

        <p className="mt-8 text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            {t("backToLogin")}
          </Link>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t("codeSentTitle")} subtitle={t("codeSentSubtitle", { email })}>
      <form ref={scope} onSubmit={resetForm.handleSubmit(onReset)} noValidate>
        <fieldset disabled={resetForm.formState.isSubmitting} className="min-w-0 space-y-4">
          <FormField
            label={t("code")}
            placeholder={t("codePlaceholder")}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            error={resetForm.formState.errors.code && tv(resetForm.formState.errors.code.message!)}
            {...resetForm.register("code")}
          />
          <FormField
            label={t("newPassword")}
            placeholder={t("newPasswordPlaceholder")}
            password
            autoComplete="new-password"
            error={resetForm.formState.errors.newPassword && tv(resetForm.formState.errors.newPassword.message!)}
            {...resetForm.register("newPassword")}
          />
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

      <div className="mt-6 flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={() => setStep("email")}
          className="font-medium text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
        >
          {t("changeEmail")}
        </button>
        <button
          type="button"
          onClick={onResend}
          disabled={isResending}
          className="font-medium text-primary underline-offset-4 hover:underline disabled:opacity-60"
        >
          {isResending ? t("resending") : t("resend")}
        </button>
      </div>
    </AuthCard>
  );
}

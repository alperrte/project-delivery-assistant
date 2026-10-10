"use client";

import { useState } from "react";
import Link from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FormField } from "@/components/common/form-field";
import { SubmitButton } from "@/components/common/submit-button";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { errorKey } from "@/lib/api/error-message";
import { authApi } from "@/features/auth/api";
import { CodeEntryStep } from "@/features/auth/components/code-entry-step";
import { PasswordRules } from "@/features/auth/components/password-rules";
import { changePasswordSchema, type ChangePasswordValues } from "@/features/auth/schemas";

/**
 * Changing the password is gated: first a code mailed to the account address, only then the form. The form is not
 * rendered before that, so the gate is visible rather than a hidden failure at submit time.
 */
export function PasswordChangePanel({ email }: { email: string }) {
  const t = useTranslations("securityFlow.password");
  const tp = useTranslations("changePassword");
  const tv = useTranslations("validation");
  const te = useTranslations("errors");
  const locale = useLocale();
  const [step, setStep] = useState<"idle" | "code" | "form">("idle");
  const [starting, setStarting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordValues>({ resolver: zodResolver(changePasswordSchema) });
  const newPassword = useWatch({ control, name: "newPassword" }) ?? "";

  async function start() {
    setStarting(true);
    try {
      await authApi.sendChangeCode({ locale });
      setStep("code");
    } catch (err) {
      toast.error(te(errorKey(err)));
    } finally {
      setStarting(false);
    }
  }

  async function onVerify(code: string) {
    await authApi.verifyChangeCode({ code });
    toast.success(t("verified"));
    setFormError(null);
    setStep("form");
  }

  async function onSubmit(values: ChangePasswordValues) {
    setFormError(null);
    try {
      await authApi.changePassword(values);
      toast.success(tp("success"));
      reset();
      setStep("idle");
    } catch (err) {
      // The 10-minute ticket ran out: the gate closes again and the code has to be requested anew.
      if (err instanceof ApiError && err.code === "verification_required") {
        toast.error(te(errorKey(err)));
        reset();
        setStep("idle");
        return;
      }
      setFormError(te(errorKey(err)));
    }
  }

  if (step === "idle") {
    return (
      <div className="max-w-md space-y-4">
        <p className="text-sm text-muted-foreground">{t("description")}</p>
        <Button type="button" onClick={start} disabled={starting} aria-busy={starting}>
          {starting ? t("starting") : t("start")}
        </Button>
      </div>
    );
  }

  if (step === "code") {
    return (
      <div className="max-w-md space-y-4">
        <div>
          <h3 className="text-sm font-semibold">{t("codeTitle")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t("codeText", { email })}</p>
        </div>
        <CodeEntryStep
          onVerify={onVerify}
          onResend={() => authApi.sendChangeCode({ locale })}
          submitLabel={t("verify")}
          submittingLabel={t("verifying")}
        />
        <Button type="button" variant="ghost" onClick={() => setStep("idle")}>
          {t("cancel")}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="max-w-md">
      <fieldset disabled={isSubmitting} className="min-w-0 space-y-4">
        <FormField
          label={tp("currentPassword")}
          placeholder={tp("currentPasswordPlaceholder")}
          password
          autoComplete="current-password"
          autoFocus
          error={errors.currentPassword && tv(errors.currentPassword.message!)}
          {...register("currentPassword")}
        />
        <p className="-mt-2 text-sm">
          <Link href="/forgot-password" className="font-medium text-primary underline-offset-4 hover:underline">
            {t("forgot")}
          </Link>
        </p>
        <FormField
          label={tp("newPassword")}
          placeholder={tp("newPasswordPlaceholder")}
          password
          autoComplete="new-password"
          error={errors.newPassword && tv(errors.newPassword.message!)}
          {...register("newPassword")}
        />
        <PasswordRules value={newPassword} />
        <FormField
          label={tp("confirmNewPassword")}
          placeholder={tp("confirmNewPasswordPlaceholder")}
          password
          autoComplete="new-password"
          error={errors.confirmNewPassword && tv(errors.confirmNewPassword.message!)}
          {...register("confirmNewPassword")}
        />

        {formError && (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton pending={isSubmitting} className="w-auto px-5">{isSubmitting ? tp("submitting") : tp("submit")}</SubmitButton>
          <Button type="button" variant="ghost" onClick={() => { reset(); setStep("idle"); }}>
            {t("cancel")}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}

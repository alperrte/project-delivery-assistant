"use client";

import { useState } from "react";
import Link from "@/i18n/navigation";
import { useRouter } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { SubmitButton } from "@/components/common/submit-button";
import { FormField } from "@/components/common/form-field";
import { ApiError } from "@/lib/api/client";
import { errorKey } from "@/lib/api/error-message";
import { authApi } from "../api";
import { registerSchema, type RegisterValues } from "../schemas";
import { trackCta } from "@/features/analytics/cta";
import { authCtaClass } from "./auth-card";
import { RegistrationNotice } from "./registration-notice";
import { PasswordRules } from "./password-rules";
import { holdCredentialsForVerification, writePendingVerification } from "./pending-verification";
import { useShake } from "./use-shake";

const SERVER_FIELDS = ["email", "nickname", "password", "confirmPassword"] as const;

export function RegisterForm() {
  const t = useTranslations("register");
  const tv = useTranslations("validation");
  const te = useTranslations("errors");
  const router = useRouter();
  const locale = useLocale();
  const [formError, setFormError] = useState<string | null>(null);
  const [scope, shake] = useShake<HTMLFormElement>();

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) });
  const password = useWatch({ control, name: "password" }) ?? "";

  async function onSubmit(values: RegisterValues) {
    setFormError(null);
    try {
      await authApi.register({ ...values, locale });
    } catch (err) {
      // Field-level 400s from the server surface next to the offending input.
      if (err instanceof ApiError && err.invalidFields) {
        for (const field of SERVER_FIELDS) {
          if (err.invalidFields[field]) setError(field, { message: field === "nickname" ? "nickname" : "required" });
        }
      }
      setFormError(te(errorKey(err)));
      shake();
      return;
    }

    trackCta("register_submit");
    // The account stays unusable until the mailed code is entered; the code was just sent, so the verify page
    // must not mail another one on arrival.
    writePendingVerification({ email: values.email, sendOnOpen: false });
    holdCredentialsForVerification(values.email, values.password);
    toast.success(t("codeSent"));
    router.replace("/verify-email");
  }

  return (
    <div>
      <form ref={scope} onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormField
          label={t("email")}
          placeholder={t("emailPlaceholder")}
          type="email"
          autoComplete="email"
          error={errors.email && tv(errors.email.message!)}
          {...register("email")}
        />
        <FormField
          label={t("nickname")}
          placeholder={t("nicknamePlaceholder")}
          autoComplete="username"
          hint={t("nicknameHint")}
          error={errors.nickname && tv(errors.nickname.message!)}
          {...register("nickname")}
        />
        <FormField
          label={t("password")}
          placeholder={t("passwordPlaceholder")}
          password
          autoComplete="new-password"
          error={errors.password && tv(errors.password.message!)}
          {...register("password")}
        />
        <PasswordRules value={password} />
        <FormField
          label={t("confirmPassword")}
          placeholder={t("confirmPasswordPlaceholder")}
          password
          autoComplete="new-password"
          error={errors.confirmPassword && tv(errors.confirmPassword.message!)}
          {...register("confirmPassword")}
        />

        {formError && (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        )}

        <SubmitButton pending={isSubmitting} className={authCtaClass}>{isSubmitting ? t("submitting") : t("submit")}</SubmitButton>
        <RegistrationNotice />
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t("haveAccount")}{" "}
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          {t("toLogin")}
        </Link>
      </p>
    </div>
  );
}

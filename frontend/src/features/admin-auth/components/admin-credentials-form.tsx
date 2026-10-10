"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, EnvelopeSimple, LockSimple } from "@phosphor-icons/react";
import { SubmitButton } from "@/components/common/submit-button";
import { FormField } from "@/components/common/form-field";
import { errorKey } from "@/lib/api/error-message";
import { authCtaClass } from "@/features/auth/components/auth-card";
import { useShake } from "@/features/auth/components/use-shake";
import { adminAuthApi, type AdminTwoFactorSetup } from "../api";
import { adminLoginSchema, type AdminLoginValues } from "../schemas";

/**
 * Step one: e-mail and password. Every wrong combination (unknown account, wrong password, an account that is not an
 * administrator, a disabled one) is the same generic error. For an administrator without an authenticator yet, the
 * enrollment secret is requested right here, so the next step opens with the QR code already in hand.
 */
export function AdminCredentialsForm({
  onTwoFactor,
  onEnroll,
}: {
  onTwoFactor: () => void;
  onEnroll: (setup: AdminTwoFactorSetup) => void;
}) {
  const t = useTranslations("adminLogin");
  const tv = useTranslations("validation");
  const te = useTranslations("errors");
  const [formError, setFormError] = useState<string | null>(null);
  const [scope, shake] = useShake<HTMLFormElement>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AdminLoginValues>({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(credentials: AdminLoginValues) {
    setFormError(null);
    try {
      const { status } = await adminAuthApi.login(credentials);
      if (status === "TWO_FACTOR_ENROLLMENT_REQUIRED") onEnroll(await adminAuthApi.setup());
      else if (status === "TWO_FACTOR_REQUIRED") onTwoFactor();
      else throw new Error("unexpected administrator sign-in answer");
    } catch (err) {
      setFormError(te(errorKey(err)));
      shake();
    }
  }

  return (
    <form ref={scope} onSubmit={handleSubmit(onSubmit)} noValidate>
      <fieldset disabled={isSubmitting} className="min-w-0 space-y-4">
        <FormField
          label={t("email")}
          hideLabel
          icon={<EnvelopeSimple size={19} />}
          placeholder={t("emailPlaceholder")}
          type="email"
          autoComplete="username"
          spellCheck={false}
          className="h-12"
          error={errors.email && tv(errors.email.message!)}
          {...register("email")}
        />
        <FormField
          label={t("password")}
          hideLabel
          icon={<LockSimple size={19} />}
          placeholder={t("passwordPlaceholder")}
          password
          autoComplete="current-password"
          className="h-12"
          error={errors.password && tv(errors.password.message!)}
          {...register("password")}
        />

        {formError && (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        )}

        <SubmitButton pending={isSubmitting} className={authCtaClass}>
          {isSubmitting ? t("submitting") : t("submit")}
          {!isSubmitting && (
            <ArrowRight
              aria-hidden
              size={17}
              weight="bold"
              className="transition-transform duration-200 group-hover/cta:translate-x-0.5"
            />
          )}
        </SubmitButton>
      </fieldset>
    </form>
  );
}

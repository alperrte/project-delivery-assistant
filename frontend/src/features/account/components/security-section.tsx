"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FormField } from "@/components/common/form-field";
import { SettingsSection } from "@/components/common/settings-section";
import { SubmitButton } from "@/components/common/submit-button";
import { errorKey } from "@/lib/api/error-message";
import { authApi } from "@/features/auth/api";
import { changePasswordSchema, type ChangePasswordValues } from "@/features/auth/schemas";

export function SecuritySection() {
  const t = useTranslations("preferences.security");
  const tp = useTranslations("changePassword");
  const tv = useTranslations("validation");
  const te = useTranslations("errors");
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordValues>({ resolver: zodResolver(changePasswordSchema) });

  async function onSubmit(values: ChangePasswordValues) {
    setFormError(null);
    try {
      await authApi.changePassword(values);
      toast.success(tp("success"));
      reset();
    } catch (err) {
      setFormError(te(errorKey(err)));
    }
  }

  return (
    <SettingsSection title={t("title")} description={t("description")}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="max-w-md">
        <fieldset disabled={isSubmitting} className="min-w-0 space-y-4">
          <FormField
            label={tp("currentPassword")}
            placeholder={tp("currentPasswordPlaceholder")}
            password
            autoComplete="current-password"
            error={errors.currentPassword && tv(errors.currentPassword.message!)}
            {...register("currentPassword")}
          />
          <FormField
            label={tp("newPassword")}
            placeholder={tp("newPasswordPlaceholder")}
            password
            autoComplete="new-password"
            error={errors.newPassword && tv(errors.newPassword.message!)}
            {...register("newPassword")}
          />
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

          <SubmitButton pending={isSubmitting}>{isSubmitting ? tp("submitting") : tp("submit")}</SubmitButton>
        </fieldset>
      </form>
    </SettingsSection>
  );
}

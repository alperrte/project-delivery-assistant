"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AuthCard, authCtaClass } from "./auth-card";
import { SubmitButton } from "@/components/common/submit-button";
import { FormField } from "@/components/common/form-field";
import { errorKey } from "@/lib/api/error-message";
import { authApi } from "../api";
import { useSession, sessionQueryKey } from "../hooks/use-session";
import { changePasswordSchema, type ChangePasswordValues } from "../schemas";
import { useShake } from "./use-shake";

/**
 * Used both for the voluntary "change my password" flow and the mandatory
 * first-login change (mustChangePassword). Unauthenticated visitors bounce
 * to /login; the subtitle reflects which case this is.
 */
export function ChangePasswordForm() {
  const t = useTranslations("changePassword");
  const tv = useTranslations("validation");
  const te = useTranslations("errors");
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: user, isLoading, isError } = useSession();
  const [formError, setFormError] = useState<string | null>(null);
  const [scope, shake] = useShake<HTMLFormElement>();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordValues>({ resolver: zodResolver(changePasswordSchema) });

  useEffect(() => {
    if (!isLoading && (isError || !user)) router.replace("/login");
  }, [isLoading, isError, user, router]);

  async function onSubmit(values: ChangePasswordValues) {
    setFormError(null);
    try {
      await authApi.changePassword(values);
      const me = await authApi.me();
      queryClient.setQueryData(sessionQueryKey, me);
      toast.success(t("success"));
      router.replace("/dashboard");
    } catch (err) {
      setFormError(te(errorKey(err)));
      shake();
    }
  }

  if (isLoading || !user) return null;

  return (
    <AuthCard title={t("title")} subtitle={user.mustChangePassword ? t("subtitleRequired") : t("subtitle")}>
      <form ref={scope} onSubmit={handleSubmit(onSubmit)} noValidate>
        <fieldset disabled={isSubmitting} className="min-w-0 space-y-4">
          <FormField
            label={t("currentPassword")}
            placeholder={t("currentPasswordPlaceholder")}
            password
            autoComplete="current-password"
            error={errors.currentPassword && tv(errors.currentPassword.message!)}
            {...register("currentPassword")}
          />
          <FormField
            label={t("newPassword")}
            placeholder={t("newPasswordPlaceholder")}
            password
            autoComplete="new-password"
            error={errors.newPassword && tv(errors.newPassword.message!)}
            {...register("newPassword")}
          />
          <FormField
            label={t("confirmNewPassword")}
            placeholder={t("confirmNewPasswordPlaceholder")}
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

          <SubmitButton pending={isSubmitting} className={authCtaClass}>{isSubmitting ? t("submitting") : t("submit")}</SubmitButton>
        </fieldset>
      </form>
    </AuthCard>
  );
}

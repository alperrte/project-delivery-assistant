"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { FormField } from "@/components/common/form-field";
import { SubmitButton } from "@/components/common/submit-button";
import { Skeleton } from "@/components/ui/skeleton";
import { errorKey } from "@/lib/api/error-message";
import { authApi } from "../api";
import { useSession } from "../hooks/use-session";
import { changePasswordSchema, type ChangePasswordValues } from "../schemas";

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-all text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

export function AccountPage() {
  const t = useTranslations("account");
  const tp = useTranslations("changePassword");
  const tv = useTranslations("validation");
  const te = useTranslations("errors");
  const { data: user } = useSession();
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

  if (!user) return <Skeleton className="h-72 w-full max-w-3xl rounded-2xl" />;

  return (
    <div className="max-w-3xl">
      <PageHeader title={t("title")} description={t("description")} />

      <div className="space-y-6">
        <section aria-labelledby="account-profile-heading" className="workspace-panel p-6">
          <h2 id="account-profile-heading" className="text-base font-semibold text-foreground">{t("profile")}</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <ProfileRow label={t("nickname")} value={user.nickname} />
            <ProfileRow label={t("email")} value={user.email} />
          </dl>
        </section>

        <section aria-labelledby="account-security-heading" className="workspace-panel p-6">
          <h2 id="account-security-heading" className="text-base font-semibold text-foreground">{t("security")}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{tp("subtitle")}</p>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-5 max-w-md">
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
        </section>
      </div>
    </div>
  );
}

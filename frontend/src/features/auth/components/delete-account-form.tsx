"use client";

import { useState } from "react";
import Link from "@/i18n/navigation";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { WarningCircle } from "@phosphor-icons/react";
import { toast } from "sonner";
import { AuthCard } from "./auth-card";
import { OwnedResources } from "./owned-resources";
import { SubmitButton } from "@/components/common/submit-button";
import { FormField } from "@/components/common/form-field";
import { ApiError } from "@/lib/api/client";
import { errorKey } from "@/lib/api/error-message";
import { authApi, type OwnedResource } from "../api";
import { deleteAccountSchema, type DeleteAccountValues } from "../schemas";
import { useQueryParams } from "./use-client-state";
import { useShake } from "./use-shake";

/**
 * The public page behind the link in the deletion mail. The token proves access to the mailbox; the account's own
 * credentials (email, plus password and/or authenticator code where it has them) prove it is the owner. The
 * authenticator field only appears once the server says the account needs it.
 */
export function DeleteAccountForm() {
  const t = useTranslations("deleteAccountPage");
  const tv = useTranslations("validation");
  const te = useTranslations("errors");
  const router = useRouter();
  const queryClient = useQueryClient();
  // undefined until mounted: the query string is client-only, and the markup must match the server's first render.
  const params = useQueryParams();
  const token = params === null ? undefined : params.get("token") || null;
  const [needsCode, setNeedsCode] = useState(false);
  const [owned, setOwned] = useState<OwnedResource[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [scope, shake] = useShake<HTMLFormElement>();

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<DeleteAccountValues>({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: { email: "", password: "", code: "" },
  });

  async function onSubmit(values: DeleteAccountValues) {
    if (!token) return;
    setFormError(null);
    setOwned(null);
    try {
      await authApi.confirmAccountDeletion({
        token,
        email: values.email,
        password: values.password || undefined,
        code: values.code.trim() || undefined,
      });
      // The server cleared the session cookies; drop what this browser still holds for the old account.
      queryClient.clear();
      toast.success(t("success"));
      router.replace("/");
    } catch (err) {
      if (err instanceof ApiError && err.code === "owns_resources" && Array.isArray(err.body?.owned)) {
        setOwned(err.body.owned as OwnedResource[]);
        return;
      }
      if (err instanceof ApiError && err.code === "two_factor_required") setNeedsCode(true);
      setFormError(te(errorKey(err)));
      shake();
    }
  }

  if (token === undefined) return <AuthCard title={t("title")} subtitle="">{null}</AuthCard>;

  if (token === null) {
    return (
      <AuthCard title={t("invalidTitle")} subtitle={t("invalidText")}>
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            {t("toLogin")}
          </Link>
          <Link href="/" className="font-medium text-muted-foreground underline-offset-4 hover:text-primary hover:underline">
            {t("backHome")}
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t("title")} subtitle={t("subtitle")}>
      <div role="note" className="mb-5 flex gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
        <WarningCircle aria-hidden size={20} weight="fill" className="mt-0.5 shrink-0" />
        <p>{t("warning")}</p>
      </div>

      <form ref={scope} onSubmit={handleSubmit(onSubmit)} noValidate>
        <fieldset disabled={isSubmitting} className="min-w-0 space-y-4">
          <FormField
            label={t("email")}
            placeholder={t("emailPlaceholder")}
            type="email"
            autoComplete="email"
            error={errors.email && tv(errors.email.message!)}
            {...register("email")}
          />
          <FormField
            label={t("password")}
            placeholder={t("passwordPlaceholder")}
            hint={t("passwordHint")}
            password
            autoComplete="current-password"
            error={errors.password && tv(errors.password.message!)}
            {...register("password")}
          />
          {needsCode && (
            <FormField
              label={t("code")}
              hint={t("codeHint")}
              autoComplete="one-time-code"
              spellCheck={false}
              autoFocus
              maxLength={32}
              className="font-mono tracking-widest"
              error={errors.code && tv(errors.code.message!)}
              {...register("code")}
            />
          )}

          {owned && (
            <OwnedResources
              items={owned}
              title={t("ownsTitle")}
              text={t("ownsText")}
              labels={{ project: t("project"), organization: t("organization") }}
            />
          )}

          {formError && (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          )}

          <SubmitButton pending={isSubmitting} className="h-12 bg-destructive text-white hover:bg-destructive/90">
            {isSubmitting ? t("submitting") : t("submit")}
          </SubmitButton>
        </fieldset>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        <Link href="/" className="font-medium text-primary underline-offset-4 hover:underline">
          {t("backHome")}
        </Link>
      </p>
    </AuthCard>
  );
}

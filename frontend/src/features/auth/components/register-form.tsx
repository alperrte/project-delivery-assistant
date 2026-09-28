"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SubmitButton } from "@/components/common/submit-button";
import { FormField } from "@/components/common/form-field";
import { ApiError } from "@/lib/api/client";
import { errorKey } from "@/lib/api/error-message";
import { authApi } from "../api";
import { registerSchema, type RegisterValues } from "../schemas";
import { sessionQueryKey } from "../hooks/use-session";
import { authCtaClass } from "./auth-card";
import { useShake } from "./use-shake";

const SERVER_FIELDS = ["email", "nickname", "password", "confirmPassword"] as const;

export function RegisterForm() {
  const t = useTranslations("register");
  const tv = useTranslations("validation");
  const te = useTranslations("errors");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [scope, shake] = useShake<HTMLFormElement>();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) });

  async function onSubmit(values: RegisterValues) {
    setFormError(null);
    try {
      await authApi.register(values);
    } catch (err) {
      // Field-level 400s from the server surface next to the offending input.
      if (err instanceof ApiError && err.invalidFields) {
        for (const field of SERVER_FIELDS) {
          if (err.invalidFields[field]) setError(field, { message: "required" });
        }
      }
      setFormError(te(errorKey(err)));
      shake();
      return;
    }

    // Sign the new account straight in with the same credentials; the backend
    // sets the HttpOnly session cookies exactly as for a normal login.
    try {
      await authApi.login({ email: values.email, password: values.password });
      const me = await authApi.me();
      queryClient.setQueryData(sessionQueryKey, me);
      toast.success(t("welcome"));
      router.replace(me.mustChangePassword ? "/change-password" : "/projects");
    } catch {
      // The account exists; only the sign-in failed (e.g. rate limit), so the
      // login page is the way forward.
      toast.success(t("success"));
      router.replace("/login");
    }
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
          hint={t("passwordHint")}
          error={errors.password && tv(errors.password.message!)}
          {...register("password")}
        />
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

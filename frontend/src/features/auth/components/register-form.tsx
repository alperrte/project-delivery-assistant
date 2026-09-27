"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleNotch } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/common/form-field";
import { ApiError } from "@/lib/api/client";
import { errorKey } from "@/lib/api/error-message";
import { authApi } from "../api";
import { registerSchema, type RegisterValues } from "../schemas";
import { useShake } from "./use-shake";

const SERVER_FIELDS = ["email", "nickname", "password", "confirmPassword"] as const;

export function RegisterForm() {
  const t = useTranslations("register");
  const tv = useTranslations("validation");
  const te = useTranslations("errors");
  const router = useRouter();
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
      toast.success(t("success"));
      router.replace("/login");
    } catch (err) {
      // Field-level 400s from the server surface next to the offending input.
      if (err instanceof ApiError && err.invalidFields) {
        for (const field of SERVER_FIELDS) {
          if (err.invalidFields[field]) setError(field, { message: "required" });
        }
      }
      setFormError(te(errorKey(err)));
      shake();
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

        <Button type="submit" disabled={isSubmitting} className="h-11 w-full text-[0.95rem] active:scale-[0.98]">
          {isSubmitting && <CircleNotch size={18} className="animate-spin" />}
          {isSubmitting ? t("submitting") : t("submit")}
        </Button>
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

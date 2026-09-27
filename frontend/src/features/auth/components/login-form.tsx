"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleNotch } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/common/form-field";
import { errorKey } from "@/lib/api/error-message";
import { authApi } from "../api";
import { loginSchema, type LoginValues } from "../schemas";
import { useShake } from "./use-shake";

export function LoginForm() {
  const t = useTranslations("login");
  const tv = useTranslations("validation");
  const te = useTranslations("errors");
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [scope, shake] = useShake<HTMLFormElement>();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginValues) {
    setFormError(null);
    try {
      await authApi.login(values);
      router.replace("/account");
    } catch (err) {
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
          label={t("password")}
          placeholder={t("passwordPlaceholder")}
          password
          autoComplete="current-password"
          error={errors.password && tv(errors.password.message!)}
          {...register("password")}
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
        {t("noAccount")}{" "}
        <Link href="/register" className="font-medium text-primary underline-offset-4 hover:underline">
          {t("toRegister")}
        </Link>
      </p>
    </div>
  );
}

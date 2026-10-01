"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, EnvelopeSimple, LockSimple } from "@phosphor-icons/react";
import { SubmitButton } from "@/components/common/submit-button";
import { FormField } from "@/components/common/form-field";
import { errorKey } from "@/lib/api/error-message";
import { authApi } from "../api";
import { loginSchema, type LoginValues } from "../schemas";
import { sessionQueryKey } from "../hooks/use-session";
import { authCtaClass } from "./auth-card";
import { useShake } from "./use-shake";

/**
 * "Remember me" keeps only the email address on this device; tokens stay in
 * HttpOnly cookies and the session length is the backend's own (sliding
 * refresh), so nothing here touches authentication state.
 */
const REMEMBERED_EMAIL = "pda.rememberedEmail";

function readRememberedEmail() {
  try {
    return window.localStorage.getItem(REMEMBERED_EMAIL);
  } catch {
    return null;
  }
}

function writeRememberedEmail(email: string | null) {
  try {
    if (email) window.localStorage.setItem(REMEMBERED_EMAIL, email);
    else window.localStorage.removeItem(REMEMBERED_EMAIL);
  } catch {
    // storage blocked (private mode, policy): remembering is best-effort
  }
}

export function LoginForm({ children }: { children?: ReactNode }) {
  const t = useTranslations("login");
  const tv = useTranslations("validation");
  const te = useTranslations("errors");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [scope, shake] = useShake<HTMLFormElement>();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: false },
  });

  useEffect(() => {
    const email = readRememberedEmail();
    if (!email) return;
    setValue("email", email);
    setValue("remember", true);
  }, [setValue]);

  async function onSubmit({ remember, ...credentials }: LoginValues) {
    setFormError(null);
    try {
      await authApi.login(credentials);
      writeRememberedEmail(remember ? credentials.email : null);
      const me = await authApi.me();
      queryClient.setQueryData(sessionQueryKey, me);
      const invitation = new URLSearchParams(window.location.hash.slice(1)).get("invitation");
      router.replace(me.mustChangePassword ? "/change-password" : invitation
        ? `/register#invitation=${encodeURIComponent(invitation)}` : "/dashboard");
    } catch (err) {
      setFormError(te(errorKey(err)));
      shake();
    }
  }

  return (
    <div>
      <form ref={scope} onSubmit={handleSubmit(onSubmit)} noValidate>
        <fieldset disabled={isSubmitting} className="min-w-0 space-y-4">
          <FormField
            label={t("email")}
            hideLabel
            icon={<EnvelopeSimple size={19} />}
            placeholder={t("emailPlaceholder")}
            type="email"
            autoComplete="email"
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

          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-0.5 text-sm">
            <label className="group flex min-h-7 cursor-pointer select-none items-center gap-2.5">
              <span className="relative grid size-[1.125rem] place-items-center">
                <input
                  type="checkbox"
                  className="peer size-full cursor-pointer appearance-none rounded-[5px] border border-(--auth-field-border) bg-(--auth-field) transition-colors checked:border-(--auth-link) checked:bg-(--auth-link) focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-(--glow)/35 group-hover:border-(--auth-link)"
                  {...register("remember")}
                />
                <Check
                  aria-hidden
                  size={12}
                  weight="bold"
                  className="pointer-events-none absolute text-white opacity-0 peer-checked:opacity-100 dark:text-[#04121a]"
                />
              </span>
              <span className="font-medium">{t("rememberMe")}</span>
            </label>
            <Link
              href="/forgot-password"
              className="rounded-sm font-medium text-(--auth-link) underline-offset-4 outline-none transition-colors hover:text-(--auth-link-hover) hover:underline focus-visible:ring-2 focus-visible:ring-(--glow)"
            >
              {t("forgotPassword")}
            </Link>
          </div>

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

      {children && <div className="mt-6">{children}</div>}

      <p className="mt-7 text-center text-sm text-(--auth-muted)">
        {t("noAccount")}{" "}
        <Link
          href="/register"
          className="rounded-sm font-semibold text-(--auth-link) underline decoration-(--auth-link)/40 underline-offset-4 outline-none transition-colors hover:text-(--auth-link-hover) hover:decoration-current focus-visible:ring-2 focus-visible:ring-(--glow)"
        >
          {t("toRegister")}
        </Link>
      </p>
    </div>
  );
}

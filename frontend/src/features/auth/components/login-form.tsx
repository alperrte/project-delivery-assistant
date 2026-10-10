"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "@/i18n/navigation";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Check, EnvelopeSimple, LockSimple } from "@phosphor-icons/react";
import { SubmitButton } from "@/components/common/submit-button";
import { HomeLink } from "@/components/common/home-link";
import { FormField } from "@/components/common/form-field";
import { ApiError } from "@/lib/api/client";
import { errorKey } from "@/lib/api/error-message";
import { authApi } from "../api";
import { loginSchema, type LoginValues } from "../schemas";
import { authCtaClass } from "./auth-card";
import { holdCredentialsForVerification, writePendingVerification } from "./pending-verification";
import { useCompleteLogin } from "./use-complete-login";
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

export function LoginForm({ children, onTwoFactor }: { children?: ReactNode; onTwoFactor: () => void }) {
  const t = useTranslations("login");
  const tv = useTranslations("validation");
  const te = useTranslations("errors");
  const router = useRouter();
  const completeLogin = useCompleteLogin();
  const [formError, setFormError] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [scope, shake] = useShake<HTMLFormElement>();

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
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
    setUnverifiedEmail(null);
    try {
      const response = await authApi.login(credentials);
      writeRememberedEmail(remember ? credentials.email : null);
      if (response?.status === "TWO_FACTOR_REQUIRED") {
        onTwoFactor();
        return;
      }
      await completeLogin();
    } catch (err) {
      setFormError(te(errorKey(err)));
      if (err instanceof ApiError && err.code === "email_not_verified") setUnverifiedEmail(credentials.email);
      shake();
    }
  }

  // The account exists but its address was never confirmed: the verify page mails a fresh code on arrival.
  function goVerify(email: string) {
    writePendingVerification({ email, sendOnOpen: true });
    const password = getValues("password");
    if (password) holdCredentialsForVerification(email, password);
    router.push("/verify-email");
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
              className="inline-flex min-h-7 items-center rounded-sm font-medium text-(--auth-link) underline-offset-4 outline-none transition-colors hover:text-(--auth-link-hover) hover:underline focus-visible:ring-2 focus-visible:ring-(--glow)"
            >
              {t("forgotPassword")}
            </Link>
          </div>

          {formError && (
            <div role="alert" className="space-y-2 text-sm text-destructive">
              <p>{formError}</p>
              {unverifiedEmail && (
                <button
                  type="button"
                  onClick={() => goVerify(unverifiedEmail)}
                  className="font-semibold underline underline-offset-4 outline-none hover:no-underline focus-visible:ring-2 focus-visible:ring-(--glow)"
                >
                  {t("verifyNow")}
                </button>
              )}
            </div>
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
      <div className="mt-3 flex justify-center">
        <HomeLink
          className="inline-flex min-h-11 items-center gap-2 rounded-sm px-2 text-sm text-(--auth-muted) underline-offset-4 outline-none transition-colors hover:text-(--auth-ink) hover:underline focus-visible:ring-2 focus-visible:ring-(--glow)"
        >
          <ArrowLeft aria-hidden size={16} />
          {t("backHome")}
        </HomeLink>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "@/i18n/navigation";
import { useRouter } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AuthCard, authCtaClass } from "./auth-card";
import { CodeEntryStep } from "./code-entry-step";
import { SubmitButton } from "@/components/common/submit-button";
import { FormField } from "@/components/common/form-field";
import { errorKey } from "@/lib/api/error-message";
import { authApi } from "../api";
import { forgotPasswordSchema, type ForgotPasswordValues } from "../schemas";
import {
  clearPendingVerification,
  readPendingVerification,
  takeHeldCredentials,
  writePendingVerification,
} from "./pending-verification";
import { useCompleteLogin } from "./use-complete-login";
import { useMounted } from "./use-client-state";
import { useShake } from "./use-shake";

/**
 * Finishes a registration: the mailed 6-digit code activates the account, then the person is signed in with the
 * password typed a moment ago (kept in memory only); without it they go to the login page. The address comes from
 * sessionStorage; without one (a bookmarked or reloaded tab) the user enters it and gets a fresh code.
 */
export function VerifyEmailForm() {
  const t = useTranslations("verifyEmail");
  const tv = useTranslations("validation");
  const te = useTranslations("errors");
  const locale = useLocale();
  const router = useRouter();
  const completeLogin = useCompleteLogin();
  const mounted = useMounted();
  // sessionStorage is client-only: read it once the page is mounted, so the server markup and first render agree.
  const pending = useMemo(() => (mounted ? readPendingVerification() : null), [mounted]);
  const [chosen, setChosen] = useState<{ step: "email" | "code"; email: string } | null>(null);
  const step = chosen?.step ?? (!mounted ? "loading" : pending ? "code" : "email");
  const email = chosen?.email ?? pending?.email ?? "";
  const [formError, setFormError] = useState<string | null>(null);
  const [scope, shake] = useShake<HTMLFormElement>();
  const started = useRef(false);

  const emailForm = useForm<ForgotPasswordValues>({ resolver: zodResolver(forgotPasswordSchema) });

  useEffect(() => {
    // Effects run twice in development; a second run must not mail a second code.
    if (!pending?.sendOnOpen || started.current) return;
    started.current = true;
    writePendingVerification({ email: pending.email, sendOnOpen: false });
    authApi.resendVerification({ email: pending.email, locale }).then(
      () => toast.success(t("resentNotice")),
      (err) => toast.error(te(errorKey(err))),
    );
  }, [pending, locale, t, te]);

  async function onRequestCode(values: ForgotPasswordValues) {
    setFormError(null);
    try {
      await authApi.resendVerification({ email: values.email, locale });
      writePendingVerification({ email: values.email, sendOnOpen: false });
      setChosen({ step: "code", email: values.email });
    } catch (err) {
      setFormError(te(errorKey(err)));
      shake();
    }
  }

  async function onVerify(code: string) {
    await authApi.verifyRegistration({ email, code });
    const held = takeHeldCredentials(email);
    clearPendingVerification();
    // With the password still in memory the person goes straight in; otherwise (reloaded tab, another address) the
    // login page is the fallback. Any failure of the automatic sign-in lands there too, the account being verified.
    if (held) {
      try {
        const response = await authApi.login({ email: held.email, password: held.password });
        if (!response?.status) {
          toast.success(t("successSignedIn"));
          await completeLogin();
          return;
        }
      } catch {
        // fall through to the login page
      }
    }
    toast.success(t("success"));
    router.replace("/login");
  }

  const backToLogin = (
    <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
      {t("backToLogin")}
    </Link>
  );

  if (step === "loading") {
    return <AuthCard title={t("title")} subtitle="">{null}</AuthCard>;
  }

  if (step === "email") {
    return (
      <AuthCard title={t("emailTitle")} subtitle={t("emailSubtitle")}>
        <form ref={scope} onSubmit={emailForm.handleSubmit(onRequestCode)} noValidate>
          <fieldset disabled={emailForm.formState.isSubmitting} className="min-w-0 space-y-4">
            <FormField
              label={t("email")}
              placeholder={t("emailPlaceholder")}
              type="email"
              autoComplete="email"
              error={emailForm.formState.errors.email && tv(emailForm.formState.errors.email.message!)}
              {...emailForm.register("email")}
            />

            {formError && (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            )}

            <SubmitButton pending={emailForm.formState.isSubmitting} className={authCtaClass}>
              {emailForm.formState.isSubmitting ? t("sending") : t("sendCode")}
            </SubmitButton>
          </fieldset>
        </form>
        <p className="mt-8 text-center text-sm text-muted-foreground">{backToLogin}</p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t("title")} subtitle={t("subtitle", { email })}>
      <CodeEntryStep
        onVerify={onVerify}
        onResend={() => authApi.resendVerification({ email, locale })}
        submitLabel={t("verify")}
        submittingLabel={t("verifying")}
        ctaClassName={authCtaClass}
      />
      <div className="mt-6 flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={() => {
            clearPendingVerification();
            setChosen({ step: "email", email: "" });
          }}
          className="font-medium text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
        >
          {t("changeEmail")}
        </button>
        {backToLogin}
      </div>
    </AuthCard>
  );
}

"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FormField } from "@/components/common/form-field";
import { SubmitButton } from "@/components/common/submit-button";
import { Button } from "@/components/ui/button";
import { errorKey } from "@/lib/api/error-message";
import { cn } from "@/lib/utils";
import { verificationCodeSchema, type VerificationCodeValues } from "../schemas";
import { useShake } from "./use-shake";

/** Match the server’s 15-minute code lifetime; do not impose a shorter UI deadline. */
const COUNTDOWN_SECONDS = 15 * 60;

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/**
 * One mailed 6-digit code with separate validity and resend clocks. Registration keeps its original deadline;
 * password reset/change retain their existing renewal behavior.
 * Registration, password reset and the account password change all use it; the caller only says what verifying and
 * resending do. Failures thrown by `onVerify` are shown with the usual error mapping.
 */
export function CodeEntryStep({
  onVerify,
  onResend,
  submitLabel,
  submittingLabel,
  ctaClassName,
  resendCooldownSeconds = COUNTDOWN_SECONDS,
  registrationTiming,
  expiredAction,
}: {
  onVerify: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
  submitLabel: string;
  submittingLabel: string;
  ctaClassName?: string;
  resendCooldownSeconds?: number;
  registrationTiming?: { issuedAt: number; lastSentAt: number };
  expiredAction?: ReactNode;
}) {
  const t = useTranslations("codeEntry");
  const tv = useTranslations("validation");
  const te = useTranslations("errors");
  const [formError, setFormError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const focusAfterResend = useRef(false);
  const [deadline, setDeadline] = useState(() => (registrationTiming?.issuedAt ?? Date.now()) + COUNTDOWN_SECONDS * 1000);
  const [resendDeadline, setResendDeadline] = useState(() =>
    (registrationTiming?.lastSentAt ?? Date.now()) + resendCooldownSeconds * 1000);
  const [now, setNow] = useState(() => Date.now());
  const [scope, shake] = useShake<HTMLFormElement>();

  const { register, handleSubmit, resetField, setFocus, formState: { errors, isSubmitting } } = useForm<VerificationCodeValues>({
    resolver: zodResolver(verificationCodeSchema),
  });

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const remaining = Math.min(COUNTDOWN_SECONDS, Math.max(0, Math.ceil((deadline - now) / 1000)));
  const expired = remaining === 0;
  const resendRemaining = Math.max(0, Math.ceil((resendDeadline - now) / 1000));
  const canResend = resendRemaining === 0 && (!registrationTiming || !expired);

  useEffect(() => {
    if (!resending && !expired && focusAfterResend.current) {
      focusAfterResend.current = false;
      scope.current?.querySelector<HTMLInputElement>('input[name="code"]')?.focus();
    }
  }, [resending, expired, scope]);

  async function submit({ code }: VerificationCodeValues) {
    setFormError(null);
    try {
      await onVerify(code);
    } catch (err) {
      setFormError(te(errorKey(err)));
      shake();
      setFocus("code", { shouldSelect: true });
    }
  }

  async function resend() {
    if (!canResend || resending || isSubmitting) return;
    setResending(true);
    setFormError(null);
    try {
      await onResend();
      focusAfterResend.current = true;
      const start = Date.now();
      if (!registrationTiming) setDeadline(start + COUNTDOWN_SECONDS * 1000);
      setResendDeadline(start + resendCooldownSeconds * 1000);
      setNow(start);
      // Keep the registered input reference so it can receive focus once the fieldset is enabled again.
      resetField("code", { defaultValue: "" });
      toast.success(t("resent"));
    } catch (err) {
      setFormError(te(errorKey(err)));
    } finally {
      setResending(false);
    }
  }

  return (
    <form ref={scope} onSubmit={handleSubmit(submit)} noValidate>
      <fieldset disabled={isSubmitting || resending || expired} className="min-w-0 space-y-4">
        <FormField
          label={t("label")}
          placeholder={t("placeholder")}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          autoFocus
          className="h-14 text-center font-mono text-2xl tracking-[0.5em] tabular-nums md:text-2xl"
          error={errors.code && tv(errors.code.message!)}
          {...register("code")}
        />

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
          <p role="timer" aria-live="off" className={cn("tabular-nums", expired ? "text-destructive" : "text-muted-foreground")}>
            {t("timeLeft", { time: clock(remaining) })}
          </p>
          <p className="text-muted-foreground">{t(registrationTiming ? "registrationValidity" : "validity")}</p>
        </div>

        <p className="text-sm text-muted-foreground">{t("spamHint")}</p>

        {formError && (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        )}

        <SubmitButton pending={isSubmitting} className={ctaClassName}>
          {isSubmitting ? submittingLabel : submitLabel}
        </SubmitButton>
      </fieldset>

      {registrationTiming && !expired && (
        <div className="mt-4 space-y-2 text-sm">
          {resendRemaining > 0 && (
            <p role="timer" aria-live="off" className="tabular-nums text-muted-foreground">
              {t("resendTimeLeft", { time: clock(resendRemaining) })}
            </p>
          )}
          <Button type="button" variant="outline" className="w-full" onClick={resend}
            disabled={!canResend || resending || isSubmitting} aria-busy={resending}>
            {resending ? t("resending") : t("resend")}
          </Button>
        </div>
      )}

      {expired && (
        <div role="status" className="mt-4 space-y-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
          <p className="text-destructive">{t(registrationTiming ? "registrationExpired" : "expired")}</p>
          {registrationTiming ? expiredAction : (
            <Button type="button" variant="outline" className="w-full" onClick={resend} disabled={resending} aria-busy={resending}>
              {resending ? t("resending") : t("resend")}
            </Button>
          )}
        </div>
      )}
    </form>
  );
}

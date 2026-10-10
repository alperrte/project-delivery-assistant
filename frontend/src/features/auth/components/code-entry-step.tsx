"use client";

import { useEffect, useState } from "react";
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

/** The screen timer: after this the field locks and a new code must be requested (the code itself lives 15 minutes). */
const COUNTDOWN_SECONDS = 180;

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/**
 * One mailed 6-digit code: a numeric field, the 3-minute countdown, and, once it runs out, "send a new code".
 * Registration, password reset and the account password change all use it; the caller only says what verifying and
 * resending do. Failures thrown by `onVerify` are shown with the usual error mapping.
 */
export function CodeEntryStep({
  onVerify,
  onResend,
  submitLabel,
  submittingLabel,
  ctaClassName,
}: {
  onVerify: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
  submitLabel: string;
  submittingLabel: string;
  ctaClassName?: string;
}) {
  const t = useTranslations("codeEntry");
  const tv = useTranslations("validation");
  const te = useTranslations("errors");
  const [formError, setFormError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  // The countdown starts when the step first renders; both clocks begin equal, so the first paint reads a full 3:00.
  const [deadline, setDeadline] = useState(() => Date.now() + COUNTDOWN_SECONDS * 1000);
  const [now, setNow] = useState(() => Date.now());
  const [scope, shake] = useShake<HTMLFormElement>();

  const { register, handleSubmit, reset, setFocus, formState: { errors, isSubmitting } } = useForm<VerificationCodeValues>({
    resolver: zodResolver(verificationCodeSchema),
  });

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const remaining = Math.min(COUNTDOWN_SECONDS, Math.max(0, Math.ceil((deadline - now) / 1000)));
  const expired = remaining === 0;

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
    setResending(true);
    setFormError(null);
    try {
      await onResend();
      const start = Date.now();
      setDeadline(start + COUNTDOWN_SECONDS * 1000);
      setNow(start);
      reset({ code: "" });
      toast.success(t("resent"));
      setFocus("code");
    } catch (err) {
      setFormError(te(errorKey(err)));
    } finally {
      setResending(false);
    }
  }

  return (
    <form ref={scope} onSubmit={handleSubmit(submit)} noValidate>
      <fieldset disabled={isSubmitting || expired} className="min-w-0 space-y-4">
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
          <p className="text-muted-foreground">{t("validity")}</p>
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

      {expired && (
        <div role="status" className="mt-4 space-y-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
          <p className="text-destructive">{t("expired")}</p>
          <Button type="button" variant="outline" className="w-full" onClick={resend} disabled={resending} aria-busy={resending}>
            {resending ? t("resending") : t("resend")}
          </Button>
        </div>
      )}
    </form>
  );
}

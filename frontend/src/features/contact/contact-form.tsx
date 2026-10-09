"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle } from "@phosphor-icons/react";
import Link from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/common/form-field";
import { SubmitButton } from "@/components/common/submit-button";
import { ApiError } from "@/lib/api/client";
import { errorKey } from "@/lib/api/error-message";
import { cn } from "@/lib/utils";
import { contactApi } from "./api";
import { CONTACT_LIMITS, contactSchema, type ContactValues } from "./schemas";

const EMPTY: ContactValues = { firstName: "", lastName: "", email: "", message: "" };
const FIELDS = ["firstName", "lastName", "email", "message"] as const;

/**
 * The public contact form. The browser's checks are a convenience: the server validates everything again and decides
 * the recipient, the sender and the subject. A second submit is impossible while one is in flight, and a message is
 * only reported as sent after the server confirmed delivery.
 */
export function ContactForm() {
  const t = useTranslations("contact");
  const tv = useTranslations("contact.validation");
  const te = useTranslations("errors");
  const ids = useId();
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const inFlight = useRef(false);
  const successHeading = useRef<HTMLHeadingElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ContactValues>({ resolver: zodResolver(contactSchema), defaultValues: EMPTY });

  const typed = useWatch({ control, name: "message" });

  useEffect(() => {
    if (sent) successHeading.current?.focus();
  }, [sent]);

  async function onSubmit(values: ContactValues) {
    if (inFlight.current) return;
    inFlight.current = true;
    setFormError(null);
    try {
      await contactApi.send(values);
      reset(EMPTY);
      setSent(true);
    } catch (error) {
      if (error instanceof ApiError && error.invalidFields) {
        for (const field of FIELDS) {
          if (field in error.invalidFields) setError(field, { message: field === "email" ? "email" : field === "message" ? "messageMin" : "required" });
        }
      }
      setFormError(te(errorKey(error)));
    } finally {
      inFlight.current = false;
    }
  }

  if (sent) {
    return (
      <div role="status" className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <CheckCircle size={32} weight="duotone" aria-hidden="true" className="text-success" />
        <h2 ref={successHeading} tabIndex={-1} className="mt-3 text-xl font-semibold outline-none">{t("success.title")}</h2>
        <p className="mt-2 max-w-prose text-sm leading-6 text-muted-foreground">{t("success.text")}</p>
        <Button type="button" variant="outline" className="mt-5 min-h-11" onClick={() => setSent(false)}>{t("success.again")}</Button>
      </div>
    );
  }

  const length = (typed ?? "").length;
  const messageId = `${ids}-message`;
  const messageError = errors.message ? tv(errors.message.message!) : undefined;
  const describedBy = [`${messageId}-hint`, messageError ? `${messageId}-error` : null].filter(Boolean).join(" ");

  return (
    <form onSubmit={(event) => { void handleSubmit(onSubmit)(event); }} noValidate aria-label={t("form.label")} className="space-y-5">
      <fieldset disabled={isSubmitting} className="min-w-0 space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            label={t("form.firstName")}
            autoComplete="given-name"
            maxLength={CONTACT_LIMITS.nameMax * 2}
            error={errors.firstName && tv(errors.firstName.message!)}
            {...register("firstName")}
          />
          <FormField
            label={t("form.lastName")}
            autoComplete="family-name"
            maxLength={CONTACT_LIMITS.nameMax * 2}
            error={errors.lastName && tv(errors.lastName.message!)}
            {...register("lastName")}
          />
        </div>
        <FormField
          label={t("form.email")}
          type="email"
          autoComplete="email"
          spellCheck={false}
          error={errors.email && tv(errors.email.message!)}
          {...register("email")}
        />
        <div className="space-y-1.5">
          <Label htmlFor={messageId}>{t("form.message")}</Label>
          <Textarea
            id={messageId}
            rows={7}
            aria-invalid={!!errors.message}
            aria-describedby={describedBy}
            className="min-h-40 max-h-96 bg-card px-3.5 py-3 leading-6"
            {...register("message")}
          />
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
            <p id={`${messageId}-hint`} className="text-sm text-muted-foreground">{t("form.messageHint")}</p>
            <p aria-hidden="true" className={cn("text-sm tabular-nums text-muted-foreground", length > CONTACT_LIMITS.messageMax && "text-destructive")}>
              {t("form.counter", { count: length })}
            </p>
          </div>
          {messageError && <p id={`${messageId}-error`} role="alert" className="text-sm text-destructive">{messageError}</p>}
        </div>

        {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}

        <SubmitButton pending={isSubmitting} className="min-h-11 w-full sm:w-auto sm:min-w-40">
          {isSubmitting ? t("form.submitting") : t("form.submit")}
        </SubmitButton>
      </fieldset>
      <p className="text-sm leading-6 text-muted-foreground">
        <span className="font-medium text-foreground">{t("notice.title")}: </span>
        {t("notice.text")}{" "}
        <Link href="/privacy" className="rounded-sm underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">{t("notice.privacy")}</Link>
      </p>
    </form>
  );
}

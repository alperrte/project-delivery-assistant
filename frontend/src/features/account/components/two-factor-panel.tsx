"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, ShieldCheck } from "@phosphor-icons/react";
import { toast } from "sonner";
import { FormField } from "@/components/common/form-field";
import { SubmitButton } from "@/components/common/submit-button";
import { AuthenticatorQr } from "./authenticator-qr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { errorKey } from "@/lib/api/error-message";
import { authApi } from "@/features/auth/api";
import { twoFactorStatusKey } from "@/features/auth/query-keys";
import { useSession } from "@/features/auth/hooks/use-session";
import {
  disableTwoFactorSchema,
  secondFactorSchema,
  type DisableTwoFactorValues,
  type SecondFactorValues,
} from "@/features/auth/schemas";

export const statusKey = twoFactorStatusKey;

type View =
  | { name: "status" }
  | { name: "setup"; secret: string; otpauthUri: string }
  | { name: "codes"; codes: string[] }
  | { name: "disable" }
  | { name: "regenerate" };

async function copyText(text: string, done: string, failed: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(done);
  } catch {
    toast.error(failed);
  }
}

/** One authenticator-or-backup code field with a confirm and a cancel button. */
function CodeForm({
  label,
  hint,
  submitLabel,
  submittingLabel,
  cancelLabel,
  onSubmit,
  onCancel,
}: {
  label: string;
  hint?: string;
  submitLabel: string;
  submittingLabel: string;
  cancelLabel: string;
  onSubmit: (code: string) => Promise<void>;
  onCancel: () => void;
}) {
  const tv = useTranslations("validation");
  const te = useTranslations("errors");
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<SecondFactorValues>({
    resolver: zodResolver(secondFactorSchema),
    defaultValues: { code: "" },
  });

  async function submit({ code }: SecondFactorValues) {
    setFormError(null);
    try {
      await onSubmit(code);
    } catch (err) {
      setFormError(te(errorKey(err)));
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate>
      <fieldset disabled={isSubmitting} className="min-w-0 space-y-4">
        <FormField
          label={label}
          hint={hint}
          inputMode="text"
          autoComplete="one-time-code"
          spellCheck={false}
          autoFocus
          maxLength={32}
          className="font-mono tracking-widest"
          error={errors.code && tv(errors.code.message!)}
          {...register("code")}
        />
        {formError && (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton pending={isSubmitting} className="w-auto px-5">
            {isSubmitting ? submittingLabel : submitLabel}
          </SubmitButton>
          <Button type="button" variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}

/** Turning two-step verification off needs the password (when the account has one) and a current code. */
function DisableForm({ passwordRequired, onDone, onCancel }: { passwordRequired: boolean; onDone: () => Promise<void>; onCancel: () => void }) {
  const t = useTranslations("securityFlow.twoFactor");
  const tc = useTranslations("securityFlow.password");
  const tv = useTranslations("validation");
  const te = useTranslations("errors");
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<DisableTwoFactorValues>({
    resolver: zodResolver(disableTwoFactorSchema),
    defaultValues: { password: "", code: "" },
  });

  async function submit(values: DisableTwoFactorValues) {
    setFormError(null);
    try {
      await authApi.twoFactorDisable({ password: passwordRequired ? values.password : undefined, code: values.code });
      toast.success(t("disabledToast"));
      await onDone();
    } catch (err) {
      setFormError(te(errorKey(err)));
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="max-w-md">
      <fieldset disabled={isSubmitting} className="min-w-0 space-y-4">
        <div>
          <h3 className="text-sm font-semibold">{t("disableTitle")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{passwordRequired ? t("disableText") : t("disableTextNoPassword")}</p>
        </div>
        {passwordRequired && (
          <FormField
            label={t("password")}
            password
            autoComplete="current-password"
            error={errors.password && tv(errors.password.message!)}
            {...register("password")}
          />
        )}
        <FormField
          label={t("code")}
          autoComplete="one-time-code"
          spellCheck={false}
          maxLength={32}
          className="font-mono tracking-widest"
          error={errors.code && tv(errors.code.message!)}
          {...register("code")}
        />
        {formError && (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton pending={isSubmitting} className="w-auto bg-destructive px-5 text-white hover:bg-destructive/90">
            {t("disableConfirm")}
          </SubmitButton>
          <Button type="button" variant="ghost" onClick={onCancel}>
            {tc("cancel")}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}

export function TwoFactorPanel() {
  const t = useTranslations("securityFlow.twoFactor");
  const te = useTranslations("errors");
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>({ name: "status" });
  // Administrator accounts must keep two-step verification on (the server refuses to turn it off), so no switch is offered.
  const { data: me } = useSession();
  const isAdmin = me?.globalRole === "ADMIN";

  const { data: status, isLoading, isError } = useQuery({ queryKey: statusKey, queryFn: authApi.twoFactorStatus });
  const refresh = () => queryClient.invalidateQueries({ queryKey: statusKey });

  const setup = useMutation({
    mutationFn: authApi.twoFactorSetup,
    onSuccess: (data) => setView({ name: "setup", ...data }),
    onError: (err) => toast.error(te(errorKey(err))),
  });

  async function enable(code: string) {
    const { recoveryCodes } = await authApi.twoFactorEnable({ code });
    toast.success(t("enabledToast"));
    setView({ name: "codes", codes: recoveryCodes });
    await refresh();
  }

  async function regenerate(code: string) {
    const { recoveryCodes } = await authApi.twoFactorRecoveryCodes({ code });
    toast.success(t("regeneratedToast"));
    setView({ name: "codes", codes: recoveryCodes });
    await refresh();
  }

  if (isLoading) return <Skeleton className="h-24 w-full max-w-md rounded-xl" />;
  if (isError || !status) return <p role="alert" className="text-sm text-destructive">{te("generic")}</p>;

  if (view.name === "setup") {
    return (
      <div className="max-w-md space-y-6">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">{t("scanTitle")}</h3>
          <p className="text-sm text-muted-foreground">{t("scanText")}</p>
          <AuthenticatorQr uri={view.otpauthUri} label={t("qrLabel")} />
          <p className="text-sm text-muted-foreground">{t("manualKey")}</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 break-all rounded-md bg-muted px-2.5 py-1.5 font-mono text-sm tracking-wider">{view.secret}</code>
            <Button type="button" variant="outline" size="sm" onClick={() => copyText(view.secret, t("copied"), te("generic"))}>
              <Copy aria-hidden size={14} />
              {t("copy")}
            </Button>
          </div>
        </div>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">{t("enterTitle")}</h3>
          <CodeForm
            label={t("code")}
            submitLabel={t("confirm")}
            submittingLabel={t("confirming")}
            cancelLabel={t("cancel")}
            onSubmit={enable}
            onCancel={() => setView({ name: "status" })}
          />
        </div>
      </div>
    );
  }

  if (view.name === "codes") {
    return (
      <div className="max-w-md space-y-4">
        <div>
          <h3 className="text-sm font-semibold">{t("codesTitle")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t("codesWarning")}</p>
        </div>
        <ul className="grid grid-cols-2 gap-2 rounded-xl border bg-muted/40 p-4 font-mono text-sm tracking-wider">
          {view.codes.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" onClick={() => copyText(view.codes.join("\n"), t("copied"), te("generic"))}>
            <Copy aria-hidden size={16} />
            {t("copyCodes")}
          </Button>
          <Button type="button" onClick={() => setView({ name: "status" })}>
            {t("codesSaved")}
          </Button>
        </div>
      </div>
    );
  }

  if (view.name === "regenerate") {
    return (
      <div className="max-w-md space-y-4">
        <p className="text-sm text-muted-foreground">{t("regenerateText")}</p>
        <CodeForm
          label={t("code")}
          submitLabel={t("regenerateConfirm")}
          submittingLabel={t("confirming")}
          cancelLabel={t("cancel")}
          onSubmit={regenerate}
          onCancel={() => setView({ name: "status" })}
        />
      </div>
    );
  }

  if (view.name === "disable") {
    return (
      <DisableForm
        passwordRequired={status.passwordRequired}
        onDone={async () => {
          setView({ name: "status" });
          await refresh();
        }}
        onCancel={() => setView({ name: "status" })}
      />
    );
  }

  return (
    <div className="max-w-md space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={status.enabled ? "default" : "secondary"} className="gap-1.5">
          {status.enabled && <ShieldCheck aria-hidden size={14} weight="fill" />}
          {status.enabled ? t("on") : t("off")}
        </Badge>
        {status.enabled && (
          <span className="text-sm text-muted-foreground">{t("codesLeft", { count: status.recoveryCodesLeft })}</span>
        )}
      </div>
      {!status.available ? (
        <p className="text-sm text-muted-foreground">{t("unavailable")}</p>
      ) : status.enabled ? (
        <div className="space-y-3">
          {isAdmin && <p className="text-sm text-muted-foreground">{t("adminRequired")}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" onClick={() => setView({ name: "regenerate" })}>
              {t("regenerate")}
            </Button>
            {!isAdmin && (
              <Button type="button" variant="outline" onClick={() => setView({ name: "disable" })}>
                {t("disable")}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <Button type="button" onClick={() => setup.mutate()} disabled={setup.isPending} aria-busy={setup.isPending}>
          {setup.isPending ? t("preparing") : t("enable")}
        </Button>
      )}
    </div>
  );
}

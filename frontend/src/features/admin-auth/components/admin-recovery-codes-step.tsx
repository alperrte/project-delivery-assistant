"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, Check, CircleNotch, Copy } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { errorKey } from "@/lib/api/error-message";
import { cn } from "@/lib/utils";
import { authCtaClass } from "@/features/auth/components/auth-card";
import { useCompleteAdminLogin } from "../hooks/use-complete-admin-login";

/**
 * The ten single-use backup codes, shown once. The session is already open at this point (the first right code
 * opened it); the person confirms having saved the codes and only then continues to the panel.
 */
export function AdminRecoveryCodesStep({ codes }: { codes: string[] }) {
  const t = useTranslations("adminLogin.codes");
  const te = useTranslations("errors");
  const completeLogin = useCompleteAdminLogin();
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function copyCodes() {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied("done");
    } catch {
      setCopied("failed");
    }
  }

  async function saved() {
    setPending(true);
    setError(null);
    try {
      await completeLogin();
    } catch (err) {
      setError(te(errorKey(err)));
      setPending(false);
    }
  }

  return (
    <div className="space-y-5">
      <ul
        aria-label={t("listLabel")}
        data-testid="admin-recovery-codes"
        className="grid grid-cols-1 gap-2 rounded-xl border border-(--auth-field-border) bg-(--auth-field) p-4 font-mono text-sm tracking-wider min-[420px]:grid-cols-2"
      >
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>

      <div>
        <Button type="button" variant="outline" className="min-h-11 px-3.5" onClick={copyCodes}>
          {copied === "done" ? <Check aria-hidden size={16} weight="bold" /> : <Copy aria-hidden size={16} />}
          {copied === "done" ? t("copied") : t("copy")}
        </Button>
        <p role="status" className="mt-2 text-sm text-destructive empty:hidden">
          {copied === "failed" ? t("copyFailed") : null}
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Button
        type="button"
        onClick={saved}
        disabled={pending}
        aria-busy={pending}
        className={cn(authCtaClass, "w-full gap-2")}
      >
        {pending ? <CircleNotch aria-hidden size={16} className="animate-spin" /> : null}
        {t("saved")}
        {!pending && <ArrowRight aria-hidden size={17} weight="bold" />}
      </Button>
    </div>
  );
}

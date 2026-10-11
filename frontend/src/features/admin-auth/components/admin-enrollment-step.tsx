"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Check, Copy } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { AuthenticatorQr } from "@/features/account/components/authenticator-qr";
import { adminAuthApi, type AdminTwoFactorSetup } from "../api";
import { AdminCodeForm } from "./admin-code-form";

/** The base32 key in groups of four, easier to type into an app; the copy button still copies it unchanged. */
const grouped = (secret: string) => secret.replace(/(.{4})(?=.)/g, "$1 ");

const badge =
  "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border border-(--auth-field-border) bg-(--auth-field) text-sm font-semibold";

/**
 * First sign-in of an administrator without an authenticator. No session exists yet. The numbered steps are an
 * ordered list; the secret is only ever held by this component and is gone once the step is left.
 */
export function AdminEnrollmentStep({
  setup,
  onBack,
  onExpired,
  onEnrolled,
}: {
  setup: AdminTwoFactorSetup;
  onBack: () => void;
  onExpired: () => void;
  onEnrolled: (recoveryCodes: string[]) => void;
}) {
  const t = useTranslations("adminLogin.enroll");
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(setup.secret);
      setCopied("done");
    } catch {
      setCopied("failed");
    }
  }

  return (
    <div>
      <ol role="list" className="space-y-6">
        <li className="flex gap-3">
          <span aria-hidden className={badge}>1</span>
          <p className="text-sm leading-relaxed">{t("step1")}</p>
        </li>

        <li className="flex gap-3">
          <span aria-hidden className={badge}>2</span>
          <div className="min-w-0 flex-1 space-y-3">
            <p className="text-sm leading-relaxed">{t("step2")}</p>
            <AuthenticatorQr uri={setup.otpauthUri} label={t("qrLabel")} size={160} />
            <p className="text-sm leading-relaxed text-(--auth-muted)">{t("manualKey")}</p>
            <div className="flex flex-wrap items-center gap-2">
              <code
                data-testid="admin-manual-key"
                className="min-w-0 break-all rounded-md border border-(--auth-field-border) bg-(--auth-field) px-2.5 py-1.5 font-mono text-sm tracking-wider"
              >
                {grouped(setup.secret)}
              </code>
              <Button type="button" variant="outline" className="min-h-11 px-3.5" onClick={copyKey}>
                {copied === "done" ? <Check aria-hidden size={16} weight="bold" /> : <Copy aria-hidden size={16} />}
                {copied === "done" ? t("copied") : t("copy")}
              </Button>
            </div>
            <p role="status" className="text-sm text-destructive empty:hidden">
              {copied === "failed" ? t("copyFailed") : null}
            </p>
          </div>
        </li>

        <li className="flex gap-3">
          <span aria-hidden className={badge}>3</span>
          <div className="min-w-0 flex-1 space-y-3">
            <p className="text-sm leading-relaxed">{t("step3")}</p>
            <AdminCodeForm
              label={t("code")}
              placeholder="123456"
              submitLabel={t("submit")}
              submittingLabel={t("submitting")}
              onExpired={onExpired}
              onSubmit={async (code) => {
                const { recoveryCodes } = await adminAuthApi.enable({ code });
                onEnrolled(recoveryCodes);
              }}
            />
          </div>
        </li>
      </ol>

      <div className="mt-5">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-11 items-center gap-2 rounded-sm text-sm text-(--auth-muted) underline-offset-4 outline-none transition-colors hover:text-(--auth-ink) hover:underline focus-visible:ring-2 focus-visible:ring-(--glow)"
        >
          <ArrowLeft aria-hidden size={16} />
          {t("back")}
        </button>
      </div>
    </div>
  );
}

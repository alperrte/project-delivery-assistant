"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Info, ShieldCheck } from "@phosphor-icons/react";
import { AuthCard } from "@/features/auth/components/auth-card";
import type { AdminTwoFactorSetup } from "../api";
import { AdminCredentialsForm } from "./admin-credentials-form";
import { AdminEnrollmentStep } from "./admin-enrollment-step";
import { AdminRecoveryCodesStep } from "./admin-recovery-codes-step";
import { AdminTotpStep } from "./admin-totp-step";

/**
 * Why the visitor is here, shown above the credentials: the administrator session ended, an older administrator
 * session has to be renewed through this sign-in, or the single-use ticket of the second step ran out.
 */
export type AdminLoginNotice = "sessionExpired" | "reauthenticate" | "ticketExpired";

/**
 * The step machine of the separate administrator sign-in:
 * credentials -> (enrollment -> backup codes | authenticator code) -> panel. Secrets live only in this component's
 * state (the enrollment key and the backup codes) and disappear when their step is left. The heading takes focus on
 * every step change so keyboard and screen-reader users land at the start of the new step.
 */
type Step =
  | { name: "credentials" }
  | { name: "totp" }
  | { name: "enroll"; setup: AdminTwoFactorSetup }
  | { name: "codes"; codes: string[] };

export function AdminLoginFlow({ initialNotice }: { initialNotice: AdminLoginNotice | null }) {
  const t = useTranslations("adminLogin");
  const [step, setStep] = useState<Step>({ name: "credentials" });
  const [notice, setNotice] = useState<AdminLoginNotice | null>(initialNotice);
  const [backup, setBackup] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shownStep = useRef(step.name);

  useEffect(() => {
    if (shownStep.current === step.name) return;
    shownStep.current = step.name;
    headingRef.current?.focus();
  }, [step.name]);

  const toCredentials = (next: AdminLoginNotice | null) => {
    setNotice(next);
    setBackup(false);
    setStep({ name: "credentials" });
  };

  const eyebrow = (
    <p className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-(--auth-field-border) bg-(--auth-field) px-3 py-1 text-xs font-semibold uppercase tracking-wider text-(--auth-link)">
      <ShieldCheck aria-hidden size={14} weight="fill" />
      {t("eyebrow")}
    </p>
  );

  if (step.name === "totp") {
    return (
      <AuthCard
        eyebrow={eyebrow}
        headingRef={headingRef}
        title={t("totp.title")}
        subtitle={backup ? t("totp.backupSubtitle") : t("totp.subtitle")}
      >
        <AdminTotpStep
          backup={backup}
          onToggleBackup={() => setBackup((value) => !value)}
          onBack={() => toCredentials(null)}
          onExpired={() => toCredentials("ticketExpired")}
        />
      </AuthCard>
    );
  }

  if (step.name === "enroll") {
    return (
      <AuthCard eyebrow={eyebrow} headingRef={headingRef} title={t("enroll.title")} subtitle={t("enroll.subtitle")}>
        <AdminEnrollmentStep
          setup={step.setup}
          onBack={() => toCredentials(null)}
          onExpired={() => toCredentials("ticketExpired")}
          onEnrolled={(codes) => setStep({ name: "codes", codes })}
        />
      </AuthCard>
    );
  }

  if (step.name === "codes") {
    return (
      <AuthCard eyebrow={eyebrow} headingRef={headingRef} title={t("codes.title")} subtitle={t("codes.warning")}>
        <AdminRecoveryCodesStep codes={step.codes} />
      </AuthCard>
    );
  }

  return (
    <AuthCard eyebrow={eyebrow} headingRef={headingRef} title={t("title")} subtitle={t("subtitle")}>
      {notice && (
        <div
          role="status"
          className="mb-5 flex gap-3 rounded-lg border border-(--auth-field-border) bg-(--auth-field) p-3 text-sm"
        >
          <Info aria-hidden size={20} weight="fill" className="mt-0.5 shrink-0 text-(--auth-link)" />
          <p>{t(`notices.${notice}`)}</p>
        </div>
      )}
      <AdminCredentialsForm
        onTwoFactor={() => {
          setNotice(null);
          setBackup(false);
          setStep({ name: "totp" });
        }}
        onEnroll={(setup) => {
          setNotice(null);
          setStep({ name: "enroll", setup });
        }}
      />
    </AuthCard>
  );
}

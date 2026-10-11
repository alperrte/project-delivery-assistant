"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "@phosphor-icons/react";
import { adminAuthApi } from "../api";
import { useCompleteAdminLogin } from "../hooks/use-complete-admin-login";
import { AdminCodeForm } from "./admin-code-form";

const linkButton =
  "inline-flex min-h-11 items-center gap-2 rounded-sm underline-offset-4 outline-none transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-(--glow)";

/**
 * Step two for an administrator who already has an authenticator: the password was right and the server holds a
 * single-use ticket cookie; only a current authenticator code (or one unused backup code) opens the session.
 */
export function AdminTotpStep({
  backup,
  onToggleBackup,
  onBack,
  onExpired,
}: {
  backup: boolean;
  onToggleBackup: () => void;
  onBack: () => void;
  onExpired: () => void;
}) {
  const t = useTranslations("adminLogin.totp");
  const completeLogin = useCompleteAdminLogin();
  // Focus belongs to the heading when the step opens; only a deliberate switch between app and backup code moves it to the field.
  const [toggled, setToggled] = useState(false);

  return (
    <div>
      <AdminCodeForm
        key={backup ? "backup" : "app"}
        backup={backup}
        label={backup ? t("backupCode") : t("code")}
        placeholder={backup ? t("backupPlaceholder") : "123456"}
        submitLabel={t("submit")}
        submittingLabel={t("submitting")}
        autoFocus={toggled}
        onExpired={onExpired}
        onSubmit={async (code) => {
          await adminAuthApi.login2fa({ code });
          await completeLogin();
        }}
      />
      <div className="mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
        <button type="button" onClick={onBack} className={`${linkButton} text-(--auth-muted) hover:text-(--auth-ink)`}>
          <ArrowLeft aria-hidden size={16} />
          {t("back")}
        </button>
        <button
          type="button"
          onClick={() => {
            setToggled(true);
            onToggleBackup();
          }}
          className={`${linkButton} font-medium text-(--auth-link) hover:text-(--auth-link-hover)`}
        >
          {backup ? t("useApp") : t("useBackup")}
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { EnvelopeSimple } from "@phosphor-icons/react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { authApi, type OwnedResource } from "@/features/auth/api";
import { OwnedResources } from "@/features/auth/components/owned-resources";

/**
 * Starts the account deletion: a mail with a one-time link goes out, and the deletion itself is finished on the
 * public page that link opens. Nothing is deleted from here. Owning a project or organization blocks it.
 */
export function DeleteAccountPanel({ email }: { email: string }) {
  const t = useTranslations("securityFlow.deleteAccount");
  const locale = useLocale();
  const [sent, setSent] = useState(false);
  const [owned, setOwned] = useState<OwnedResource[] | null>(null);

  async function request() {
    try {
      await authApi.requestAccountDeletion({ locale });
      setOwned(null);
      setSent(true);
    } catch (err) {
      // Not an error to retry: the dialog closes and the list says what has to be handed over first.
      if (err instanceof ApiError && err.code === "owns_resources" && Array.isArray(err.body?.owned)) {
        setSent(false);
        setOwned(err.body.owned as OwnedResource[]);
        return;
      }
      throw err;
    }
  }

  return (
    <div className="max-w-md space-y-4">
      <p className="text-sm text-muted-foreground">{t("text")}</p>

      {owned && (
        <OwnedResources
          items={owned}
          title={t("ownsTitle")}
          text={t("ownsText")}
          labels={{ project: t("project"), organization: t("organization") }}
        />
      )}

      {sent && (
        <div role="status" className="flex gap-3 rounded-xl border bg-muted/40 p-4 text-sm">
          <EnvelopeSimple aria-hidden size={20} className="mt-0.5 shrink-0 text-primary" />
          <div>
            <p className="font-semibold">{t("sentTitle")}</p>
            <p className="mt-1 text-muted-foreground">{t("sentText", { email })}</p>
          </div>
        </div>
      )}

      <ConfirmDialog
        trigger={<Button type="button" variant="destructive">{t("button")}</Button>}
        title={t("dialogTitle")}
        description={t("dialogText")}
        confirmLabel={t("confirm")}
        cancelLabel={t("cancel")}
        destructive
        onConfirm={request}
      />
    </div>
  );
}

"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { closeConsentPreferences, saveConsent, useConsent, usePreferencesOpen } from "./consent-store";

function CategoryRow({ id, title, description, badge, checked, disabled, onChange }: {
  id: string;
  title: string;
  description: string;
  badge?: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (next: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border p-3.5">
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        aria-describedby={`${id}-description`}
        onCheckedChange={(next) => onChange?.(next === true)}
        className={cn("mt-0.5 size-5", disabled && "opacity-60")}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <label htmlFor={id} className="text-sm font-medium">{title}</label>
          {badge && <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">{badge}</span>}
        </div>
        <p id={`${id}-description`} className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

/** Mounted only while the dialog is open, so the draft always starts from the saved decision (analytics off by default). */
function PreferencesForm() {
  const t = useTranslations("consent.dialog");
  const consent = useConsent();
  const ids = useId();
  const [analytics, setAnalytics] = useState(consent.analytics);

  function finish(next: boolean) {
    saveConsent(next);
    closeConsentPreferences();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("title")}</DialogTitle>
        <DialogDescription>
          {t("description")}{" "}
          <Link href="/cookies" onClick={closeConsentPreferences}>{t("policy")}</Link>
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <CategoryRow
          id={`${ids}-necessary`}
          title={t("necessary.title")}
          description={t("necessary.description")}
          badge={t("necessary.badge")}
          checked
          disabled
        />
        <CategoryRow
          id={`${ids}-analytics`}
          title={t("analytics.title")}
          description={t("analytics.description")}
          checked={analytics}
          onChange={setAnalytics}
        />
      </div>
      <DialogFooter className="sm:flex-wrap">
        <Button variant="outline" className="min-h-11" onClick={() => finish(false)}>{t("rejectAll")}</Button>
        <Button variant="outline" className="min-h-11" onClick={() => finish(true)}>{t("acceptAll")}</Button>
        <Button className="min-h-11" onClick={() => finish(analytics)}>{t("save")}</Button>
      </DialogFooter>
    </>
  );
}

export function ConsentDialog() {
  const open = usePreferencesOpen();
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) closeConsentPreferences(); }}>
      <DialogContent data-cookie-dialog>
        <PreferencesForm />
      </DialogContent>
    </Dialog>
  );
}

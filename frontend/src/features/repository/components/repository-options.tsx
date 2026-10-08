"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Info } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { RepositorySettings, RepositoryTrackingMode } from "../types";

const MODES: RepositoryTrackingMode[] = ["BASIC", "ADVANCED"];

/** Basit / Gelişmiş mod kartları, (i) açıklaması ve bildirim anahtarı; oluşturma ekranı ile proje ayarları ortak kullanır. */
export function RepositoryOptions({
  value,
  onChange,
  disabled = false,
}: {
  value: RepositorySettings;
  onChange: (next: RepositorySettings) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("repository.options");
  const name = useId();
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <fieldset disabled={disabled} className="@container min-w-0 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <legend className="text-sm font-medium">{t("modeLabel")}</legend>
        <Button type="button" variant="ghost" size="icon" aria-label={t("help")} onClick={() => setHelpOpen(true)}>
          <Info size={20} aria-hidden="true" />
        </Button>
      </div>
      <div className="grid gap-3 @lg:grid-cols-2">
        {MODES.map((mode) => (
          <label
            key={mode}
            className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50"
          >
            <input
              type="radio"
              name={name}
              value={mode}
              checked={value.trackingMode === mode}
              onChange={() => onChange({ ...value, trackingMode: mode })}
              className="mt-1 size-4 shrink-0 accent-primary"
            />
            <span className="min-w-0 space-y-1 break-words">
              <span className="block text-sm font-medium">{t(`mode.${mode}`)}</span>
              <span className="block text-xs leading-5 text-muted-foreground">{t(`modeSummary.${mode}`)}</span>
            </span>
          </label>
        ))}
      </div>
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50">
        <input
          type="checkbox"
          role="switch"
          checked={value.notifyOnCommits}
          onChange={(event) => onChange({ ...value, notifyOnCommits: event.target.checked })}
          className="mt-1 size-4 shrink-0 accent-primary"
        />
        <span className="min-w-0 space-y-1 break-words">
          <span className="block text-sm font-medium">{t("notifyLabel")}</span>
          <span className="block text-xs leading-5 text-muted-foreground">{t("notifyHint")}</span>
        </span>
      </label>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("helpTitle")}</DialogTitle>
            <DialogDescription>{t("helpDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm leading-6">
            {MODES.map((mode) => (
              <div key={mode}>
                <h3 className="font-semibold">{t(`mode.${mode}`)}</h3>
                <p className="text-muted-foreground">{t(`modeDetail.${mode}`)}</p>
              </div>
            ))}
            <p className="text-muted-foreground">{t("helpNotify")}</p>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setHelpOpen(false)}>
              {t("close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </fieldset>
  );
}

export const DEFAULT_REPOSITORY_SETTINGS: RepositorySettings = { trackingMode: "BASIC", notifyOnCommits: true };

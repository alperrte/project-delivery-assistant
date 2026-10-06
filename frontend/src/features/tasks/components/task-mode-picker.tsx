"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Info } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { TaskManagementMode } from "@/features/projects/types";
import { allowsCreation } from "../task-model";
import type { TaskCreationMode } from "../types";

const preferenceKey = (userId: string) => `pda:task-mode-help:v1:${userId}`;

export function TaskModePicker({ value, policy, userId, onChange }: { value: TaskCreationMode; policy: TaskManagementMode | null; userId: string; onChange: (mode: TaskCreationMode) => void }) {
  const t = useTranslations("taskModels");
  const id = useId();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<TaskCreationMode | null>(null);
  const [hide, setHide] = useState(false);
  function select(mode: TaskCreationMode) {
    if (mode === value) return;
    try {
      if (localStorage.getItem(preferenceKey(userId)) === "hidden") { onChange(mode); return; }
    } catch { /* Storage may be unavailable; the explanation still works. */ }
    setPending(mode); setOpen(true);
  }
  function accept() {
    if (pending) {
      try { if (hide) localStorage.setItem(preferenceKey(userId), "hidden"); } catch { /* Optional preference. */ }
      onChange(pending);
    }
    setOpen(false); setPending(null);
  }
  return <>
    <div className="mb-8 flex flex-wrap items-center gap-3">
      <div role="group" aria-label={t("type")} className="flex min-w-0 max-w-full gap-1 rounded-lg border bg-muted/40 p-1">
        {(["SIMPLE", "ADVANCED"] as const).map((mode) => <Button key={mode} type="button" className="h-auto min-h-10 min-w-0 shrink whitespace-normal px-3 py-2" variant={value === mode ? "secondary" : "ghost"} aria-pressed={value === mode} disabled={value !== mode && !allowsCreation(policy, mode)} onClick={() => select(mode)}>{t(`mode.${mode}`)}</Button>)}
      </div>
      <Button type="button" variant="ghost" size="icon" aria-label={t("help")} onClick={() => { setPending(null); setOpen(true); }}><Info size={20} aria-hidden="true" /></Button>
    </div>
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setPending(null); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("helpTitle")}</DialogTitle><DialogDescription>{t("helpDescription")}</DialogDescription></DialogHeader>
        <div className="space-y-4 text-sm leading-6">
          <div><h3 className="font-semibold">{t("mode.SIMPLE")}</h3><p className="text-muted-foreground">{t("simpleFeatures")}</p></div>
          <div><h3 className="font-semibold">{t("mode.ADVANCED")}</h3><p className="text-muted-foreground">{t("advancedFeatures")}</p></div>
          <p className="text-muted-foreground">{t("comments")}</p>
          {pending && <label htmlFor={id} className="flex cursor-pointer items-center gap-2"><input id={id} type="checkbox" checked={hide} onChange={(event) => setHide(event.target.checked)} className="size-4 accent-primary" />{t("dontShow")}</label>}
        </div>
        <DialogFooter>
          {pending && <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>}
          <Button type="button" onClick={accept}>{t(pending ? "continue" : "close")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}

export function TaskModeBadge({ mode }: { mode: TaskCreationMode }) {
  const t = useTranslations("taskModels.mode");
  return <span className="inline-flex rounded-md border px-1.5 py-0.5 text-xs text-muted-foreground">{t(mode)}</span>;
}

export function AdvancedReadOnlyNotice() {
  const t = useTranslations("taskModels");
  return <p role="status" className="mb-6 rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">{t("readOnly")}</p>;
}

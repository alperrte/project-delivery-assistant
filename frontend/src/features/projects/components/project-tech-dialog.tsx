"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PencilSimple } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MAX_TECH_SELECTION } from "../tech-catalog";
import type { ProjectType } from "../types";
import { TechPicker } from "./create/tech-picker";

/**
 * Edits the project's technologies in a dedicated pop-up, with the same logo chips as the create flow. The current
 * selection comes in pre-selected; nothing reaches the form until "Uygula", and the form's own save bar keeps the
 * change on the server. This holds more than a short confirmation, which the design rules otherwise keep out of
 * dialogs; it is a deliberate, user-approved exception.
 */
export function ProjectTechDialog({ type, value, onApply }: {
  type: ProjectType | undefined;
  value: string[];
  onApply: (next: string[]) => void;
}) {
  const t = useTranslations("projects.settings.techDialog");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(value);

  function show() {
    setDraft(value);
    setOpen(true);
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={show}>
        <PencilSimple size={14} data-icon="inline-start" aria-hidden="true" />
        {t("edit")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description", { max: MAX_TECH_SELECTION })}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[55dvh] overflow-y-auto pr-1">
            <TechPicker type={type} value={draft} onChange={setDraft} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              type="button"
              onClick={() => {
                onApply(draft);
                setOpen(false);
              }}
            >
              {t("apply")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

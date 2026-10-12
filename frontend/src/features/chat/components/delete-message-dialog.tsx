"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CircleNotch } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { errorKey } from "@/lib/api/error-message";

/** Confirmation before an own message is deleted for everybody. The error stays in the dialog so the user can retry. */
export function DeleteMessageDialog({ open, onOpenChange, onConfirm }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}) {
  const t = useTranslations("chat.delete");
  const te = useTranslations("errors");
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const inFlight = useRef(false);

  async function confirm() {
    if (inFlight.current) return;
    inFlight.current = true;
    setFailure(null);
    setPending(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (error) {
      setFailure(te(errorKey(error)));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!inFlight.current) { setFailure(null); onOpenChange(next); } }}>
      <DialogContent showCloseButton={false} data-testid="chat-delete-dialog">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        {failure && <p role="alert" className="text-sm break-words text-destructive">{failure}</p>}
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>{t("cancel")}</Button>
          <Button variant="destructive" disabled={pending} onClick={() => void confirm()} data-testid="chat-delete-confirm">
            {pending && <CircleNotch size={16} className="animate-spin" aria-hidden="true" />}
            {t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

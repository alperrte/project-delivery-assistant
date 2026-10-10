"use client";

import { useId, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { errorKey } from "@/lib/api/error-message";
import { CircleNotch } from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ConfirmDialogProps = {
  trigger: ReactNode;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  onConfirm: () => Promise<void>;
  formatError?: (error: unknown) => string;
  /**
   * GitHub-style guard for irreversible actions: the confirm button stays off until the user has typed `value` exactly
   * (case and surrounding spaces included). `label` is the sentence above the field.
   */
  requireText?: { value: string; label: ReactNode };
  /** Where focus goes when the dialog closes (default: the trigger). Use it when the trigger is gone or disabled afterwards. */
  finalFocus?: ComponentProps<typeof DialogContent>["finalFocus"];
};

export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive,
  onConfirm,
  formatError,
  requireText,
  finalFocus,
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const inFlight = useRef(false);
  const te = useTranslations("errors");
  const typedId = useId();
  const unlocked = !requireText || typed === requireText.value;

  async function handleConfirm() {
    if (inFlight.current || !unlocked) return;
    inFlight.current = true;
    setFailure(null);
    setPending(true);
    try {
      await onConfirm();
      setOpen(false);
    } catch (error) {
      setFailure(formatError ? formatError(error) : te(errorKey(error)));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={next => { if (!inFlight.current) { setOpen(next); setFailure(null); setTyped(""); } }}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent finalFocus={finalFocus}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {requireText && (
          <div className="space-y-2">
            <Label htmlFor={typedId} className="block font-normal leading-6">{requireText.label}</Label>
            <Input
              id={typedId}
              value={typed}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              disabled={pending}
              onChange={event => setTyped(event.target.value)}
              onKeyDown={event => {
                if (event.key === "Enter" && unlocked) {
                  event.preventDefault();
                  void handleConfirm();
                }
              }}
            />
          </div>
        )}
        {failure && <p role="alert" className="break-words text-sm text-destructive">{failure}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button variant={destructive ? "destructive" : "default"} onClick={handleConfirm} disabled={pending || !unlocked}>
            {pending && <CircleNotch size={16} className="animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

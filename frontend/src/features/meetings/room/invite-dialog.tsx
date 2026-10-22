"use client";
import { useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { localizeHref } from "@/i18n/routing";
import type { Locale } from "@/i18n/config";
import { meetingsApi } from "../api";
import { MeetingError } from "../shared";

const HOURS = ["1", "24", "168"] as const;

/**
 * Creates a guest invite for the running meeting with the same endpoint the detail page uses (so the same limits and the same
 * "only a link, never the secret on screen" rule apply) and copies the link. Only organizers and project managers get the trigger.
 */
export function InviteDialog({ projectId, meetingId, trigger }: { projectId: string; meetingId: string; trigger: ReactNode }) {
  const t = useTranslations("meetings"), locale = useLocale() as Locale;
  const [open, setOpen] = useState(false), [hours, setHours] = useState<(typeof HOURS)[number]>("24"), [maxUses, setMaxUses] = useState(1);
  const [busy, setBusy] = useState(false), [error, setError] = useState<unknown>(), [link, setLink] = useState<string>(), [copied, setCopied] = useState(false);
  const options = HOURS.map(value => ({ value, label: t(`inviteFor.${value}`) }));
  function change(next: boolean) { setOpen(next); if (!next) { setError(undefined); setLink(undefined); setCopied(false); } }
  async function create() {
    if (busy) return;
    setBusy(true); setError(undefined); setCopied(false);
    try {
      const invite = await meetingsApi.invite(projectId, meetingId, { expiresAt: new Date(Date.now() + Number(hours) * 3600_000).toISOString(), maxUses });
      const url = `${window.location.origin}${localizeHref("/meeting-guest", locale)}#${encodeURIComponent(invite.token)}`;
      setLink(url);
      await navigator.clipboard.writeText(url).then(() => setCopied(true)).catch(() => {});
    } catch (failure) { setError(failure); } finally { setBusy(false); }
  }
  async function copy() { if (link) { try { await navigator.clipboard.writeText(link); setCopied(true); } catch (failure) { setError(failure); } } }
  return <Dialog open={open} onOpenChange={change}>
    <DialogTrigger render={trigger as React.ReactElement} />
    <DialogContent>
      <DialogHeader><DialogTitle>{t("inviteGuest")}</DialogTitle><DialogDescription>{t("invitePolicy")}</DialogDescription></DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2"><Label htmlFor="room-invite-hours">{t("inviteValidity")}</Label>
          <Select value={hours} items={options} modal={false} onValueChange={next => { if (typeof next === "string") setHours(next as (typeof HOURS)[number]); }}>
            <SelectTrigger id="room-invite-hours" className="h-11 w-full"><SelectValue /></SelectTrigger>
            <SelectContent alignItemWithTrigger={false} align="start">{options.map(option => <SelectItem key={option.value} value={option.value} className="min-h-11">{option.label}</SelectItem>)}</SelectContent>
          </Select></div>
        <div className="space-y-2"><Label htmlFor="room-invite-uses">{t("maxUses")}</Label><Input id="room-invite-uses" type="number" min={1} max={100} value={maxUses} onChange={event => setMaxUses(Number(event.target.value))} className="h-11" /></div>
        {error != null && <MeetingError error={error} />}
        {link && <p role="status" className="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2 text-sm text-success">{copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}{copied ? t("inviteCopied") : t("inviteReady")}</p>}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => change(false)}>{t(link ? "done" : "cancel")}</Button>
        {link ? <Button variant="accent" onClick={() => void copy()}><Copy size={16} aria-hidden="true" />{t("copy")}</Button>
          : <Button variant="accent" disabled={busy || maxUses < 1 || maxUses > 100} onClick={() => void create()}>{t("createInvite")}</Button>}
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}

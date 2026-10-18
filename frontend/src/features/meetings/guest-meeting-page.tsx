"use client";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createGuestSession, previewGuestMeeting } from "./api";
import { MeetingError } from "./shared";
import type { GuestMeeting } from "./types";

/** Invitation capability stays in memory; it never becomes a query key, route, analytics field or browser storage. */
export function GuestMeetingPage() {
  const t = useTranslations("meetings"), locale = useLocale(), router = useRouter();
  const token = useRef<string | null>(null);
  const [meeting, setMeeting] = useState<GuestMeeting>(), [error, setError] = useState<unknown>();
  const [name, setName] = useState(""), [busy, setBusy] = useState(false), [missing, setMissing] = useState(false);
  const [attempt, setAttempt] = useState(0), lock = useRef(false);
  useEffect(() => {
    const receive = () => {
      if (!window.location.hash) return;
      token.current = null; setMeeting(undefined); setMissing(false); setError(undefined); setAttempt(n => n + 1);
    };
    window.addEventListener("hashchange", receive); return () => window.removeEventListener("hashchange", receive);
  }, []);
  useEffect(() => {
    const abort = new AbortController();
    if (token.current === null) {
      try { token.current = decodeURIComponent(window.location.hash.slice(1)); } catch { token.current = ""; }
      window.history.replaceState(window.history.state, "", window.location.pathname);
    }
    if (!token.current || token.current.length > 100) { setMissing(true); return; }
    void previewGuestMeeting(token.current, abort.signal).then(value => { if (!abort.signal.aborted) { setMeeting(value); setError(undefined); } }).catch(failure => { if (!abort.signal.aborted) setError(failure); });
    return () => abort.abort();
  }, [attempt]);
  async function enter() {
    if (!token.current || lock.current || !name.trim()) return;
    lock.current = true; setBusy(true); setError(undefined);
    try {
      const session = await createGuestSession(token.current, name.trim()); token.current = "";
      router.replace(`/meeting-guest/${session.meetingId}`);
    } catch (failure) { setError(failure); } finally { lock.current = false; setBusy(false); }
  }
  return <main className="grid min-h-dvh place-items-center bg-background px-4 py-12"><div className="workspace-panel w-full max-w-xl space-y-6 p-6 sm:p-8"><p className="text-sm font-semibold text-primary">PDA</p><h1 className="break-words text-2xl font-semibold">{meeting?.title ?? t("guestJoin")}</h1>
    {missing ? <p role="alert" className="text-sm text-destructive">{t("invalidInvite")}</p> : <>{error != null && <MeetingError error={error} retry={() => setAttempt(n => n + 1)} />}{!meeting && error == null && <p role="status">{t("loading")}</p>}{meeting && <>
      <p className="text-sm leading-6 text-muted-foreground">{new Date(meeting.startsAt).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })} – {new Date(meeting.endsAt).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })}</p>
      {!!meeting.agenda.length && <ol className="list-inside list-decimal space-y-2 text-sm">{meeting.agenda.map((item, i) => <li key={i} className="break-words">{item}</li>)}</ol>}
      <p className="text-sm leading-6 text-muted-foreground">{t("guestPrivacy")} {t(meeting.chatRetained ? "chatRetained" : "chatTemporary")}</p>
      {meeting.status !== "OPEN" ? <div className="space-y-3"><p role="status">{t(meeting.status === "SCHEDULED" ? "notStarted" : "closed")}</p>{meeting.status === "SCHEDULED" && <Button variant="outline" onClick={() => setAttempt(n => n + 1)}>{t("refreshPreview")}</Button>}</div> : <form onSubmit={e => { e.preventDefault(); void enter(); }} className="space-y-4"><Label htmlFor="guest-name">{t("displayName")}</Label><Input id="guest-name" name="displayName" autoComplete="nickname" required maxLength={80} pattern={"[^<>\\p{Cc}]+"} value={name} onChange={e => setName(e.target.value)} /><Button type="submit" className="min-h-11 w-full" disabled={busy || !name.trim()}>{t(busy ? "connecting" : "continue")}</Button></form>}
    </>}</>}
  </div></main>;
}

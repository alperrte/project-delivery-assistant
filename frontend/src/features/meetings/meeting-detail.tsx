"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import Link from "@/i18n/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TimePicker } from "@/components/ui/time-picker";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { PageHeader } from "@/components/common/page-header";
import { PageContainer } from "@/components/common/page-container";
import { meetingsApi, meetingConnectionApi } from "./api";
import { localDateTime, MeetingError, MeetingStatus, useMeeting } from "./shared";
import { MeetingForm } from "./meeting-form";
import { isInCallPhase, useOptionalMeetingSession } from "./session/meeting-session";
import type { MeetingInvite } from "./types";
import { localizeHref } from "@/i18n/routing";
import type { Locale } from "@/i18n/config";
import { membersApi } from "@/features/projects/members-api";

export function MeetingDetail({ slug, id, edit = false }: { slug: string; id: string; edit?: boolean }) {
  const context = useMeeting(slug, id), t = useTranslations("meetings"), locale = useLocale(), client = useQueryClient();
  const [error, setError] = useState<unknown>(), [busy, setBusy] = useState(false);
  const [invites, setInvites] = useState<MeetingInvite[]>([]), [copied, setCopied] = useState<string>();
  // Same shared pickers as the meeting form; the invite still sends one local date-time converted to an ISO instant.
  const [expiry, setExpiry] = useState(() => { const value = localDateTime(new Date(Date.now() + 86400_000).toISOString()); return { date: value.slice(0, 10), time: value.slice(11, 16) }; });
  // The backend accepts an expiry from now to 30 days ahead; the calendar offers just those days.
  const [expiryBounds] = useState(() => ({ min: localDateTime(new Date().toISOString()).slice(0, 10), max: localDateTime(new Date(Date.now() + 30 * 86400_000).toISOString()).slice(0, 10) }));
  const expiresAt = expiry.date && expiry.time ? `${expiry.date}T${expiry.time}` : "";
  const [maxUses, setMaxUses] = useState(1);
  const [invitePage, setInvitePage] = useState(0);
  const session = useOptionalMeetingSession(), activeCall = session?.target;
  const callLive = !!session?.live && isInCallPhase(session.live.phase);
  const inThisCall = callLive && activeCall?.id === id, inOtherCall = callLive && !!activeCall && activeCall.id !== id;
  const canManageInvites = !!context.query.data && (context.isManager || context.user?.id === context.query.data.organizerId);
  const inviteMetadata = useQuery({ queryKey: [...context.keys, id, "invites", invitePage], enabled: !!context.project && canManageInvites && !edit,
    queryFn: ({ signal }) => meetingsApi.invites(context.project!.id, id, invitePage, signal), retry: false });
  const participants = useQuery({ queryKey: [...context.keys, id, "participants"], enabled: !!context.project && !edit,
    queryFn: ({ signal }) => meetingConnectionApi(context.project!.id, id).participants(signal), retry: false, refetchInterval: 10_000 });
  const meeting = context.query.data;
  const organizer = useQuery({ queryKey: [...context.keys, "organizer", meeting?.organizerId], enabled: !!context.project && !!meeting,
    queryFn: ({ signal }) => membersApi.detail(context.project!.id, meeting!.organizerId, signal), retry: false });
  async function action(kind: "start" | "cancel" | "end") {
    const result = await meetingsApi.action(context.project!.id, id, kind);
    client.setQueryData([...context.keys, id], result);
    await client.invalidateQueries({ queryKey: context.keys });
  }
  async function createInvite() {
    if (busy) return;
    setBusy(true); setError(undefined);
    try { const invite = await meetingsApi.invite(context.project!.id, id, { expiresAt: new Date(expiresAt).toISOString(), maxUses }); setInvites(previous => [...previous, invite]); setInvitePage(0); await client.invalidateQueries({ queryKey: [...context.keys, id, "invites"] }); }
    catch (failure) { setError(failure); } finally { setBusy(false); }
  }
  async function copy(invite: MeetingInvite) {
    try { await navigator.clipboard.writeText(`${window.location.origin}${localizeHref("/meeting-guest", locale as Locale)}#${encodeURIComponent(invite.token)}`); setCopied(invite.id); }
    catch (failure) { setError(failure); }
  }
  if (context.isError || context.query.isError) return <MeetingError error={context.error ?? context.query.error} retry={() => void context.query.refetch()} />;
  if (!meeting) return <p role="status">{t("loading")}</p>;
  if (edit) return <MeetingForm key={meeting.id} slug={slug} meeting={meeting} />;
  const canEdit = context.isManager || context.user?.id === meeting.organizerId;
  return <PageContainer width="form"><Link href={`/projects/${slug}/meetings`} className="mb-4 inline-flex min-h-11 items-center text-sm underline underline-offset-4">{t("back")}</Link>
    <PageHeader title={meeting.title} description={context.project?.name} action={<MeetingStatus meeting={meeting} />} />
    {error != null && <MeetingError error={error} />}
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="workspace-panel min-w-0 space-y-6 p-6"><p className="whitespace-pre-wrap break-words text-sm leading-7 text-muted-foreground">{meeting.description}</p>
        <p className="text-sm"><span className="text-muted-foreground">{t("createdBy")}: </span>{organizer.data?.nickname ?? t("member")}</p>
        <p className="text-sm text-muted-foreground">{t("plannedAttendees")}: {meeting.attendeeIds.length}</p>
        <dl className="grid gap-5 border-y py-5 sm:grid-cols-2">{(["start", "end"] as const).map((key, i) => <div key={key}><dt className="mb-1 text-xs text-muted-foreground">{t(key)}</dt><dd><time dateTime={i ? meeting.endsAt : meeting.startsAt}>{new Date(i ? meeting.endsAt : meeting.startsAt).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })}</time></dd></div>)}</dl>
        <p className="text-xs text-muted-foreground">{t("timezone", { zone: Intl.DateTimeFormat().resolvedOptions().timeZone })}</p>
        {meeting.overtime && meeting.status === "OPEN" && <p role="status" className="rounded-lg bg-warning/10 p-3 text-sm text-warning">{t("overtime")}</p>}
        <section><h2 className="mb-3 font-semibold">{t("agenda")}</h2>{meeting.agenda.length ? <ol className="list-inside list-decimal space-y-3 text-sm leading-6">{meeting.agenda.map((item, i) => <li key={i} className="whitespace-pre-wrap break-words">{item}</li>)}</ol> : <p className="text-sm text-muted-foreground">{t("noAgenda")}</p>}</section>
        <p className="text-xs leading-5 text-muted-foreground">{t(meeting.chatRetained ? "chatRetained" : "chatTemporary")}</p>
        {meeting.cleanupPending && <p role="status" className="text-sm text-warning">{t("cleanupPending")}</p>}
      </div>
      <aside className="space-y-5"><div className="workspace-panel space-y-3 p-5">
        {/* Media CSP and Permissions-Policy belong to the document, so entering a room requires a full navigation. */}
        {meeting.status === "OPEN" && (inThisCall
          // A call already running in this tab is resumed in place: a full page load would hang it up.
          ? <Link href={`/projects/${slug}/meetings/${id}/room`} className={buttonVariants({ className: "min-h-11 w-full" })}>{t("returnToMeeting")}</Link>
          : inOtherCall && activeCall
            ? <div role="status" className="space-y-2 rounded-lg bg-muted/50 p-3 text-sm"><p>{t("otherMeetingBody", { title: session?.live?.meeting?.title ?? t("group") })}</p><Link href={activeCall.roomHref} className={buttonVariants({ variant: "outline", className: "min-h-11 w-full" })}>{t("returnToActive")}</Link></div>
            : <a href={localizeHref(`/projects/${slug}/meetings/${id}/room`, locale as Locale)} className={buttonVariants({ className: "min-h-11 w-full" })}>{t("join")}</a>)}
        {meeting.status === "SCHEDULED" && canEdit && <><Button className="min-h-11 w-full" disabled={busy} onClick={async () => { setBusy(true); try { await action("start"); } catch (failure) { setError(failure); } finally { setBusy(false); } }}>{t("startNow")}</Button><Link href={`/projects/${slug}/meetings/${id}/edit`} className={buttonVariants({ variant: "outline", className: "min-h-11 w-full" })}>{t("edit")}</Link><ConfirmDialog trigger={<Button variant="ghost" className="w-full">{t("cancelMeeting")}</Button>} title={t("cancelMeeting")} confirmLabel={t("confirm")} cancelLabel={t("cancel")} onConfirm={() => action("cancel")} /></>}
        {meeting.status === "OPEN" && context.isManager && <ConfirmDialog trigger={<Button variant="destructive" className="min-h-11 w-full">{t("endForAll")}</Button>} title={t("endForAll")} description={t("endConfirm")} confirmLabel={t("confirm")} cancelLabel={t("cancel")} destructive onConfirm={() => action("end")} />}
        <h2 className="pt-3 font-semibold">{t("participants")}</h2>{participants.isError ? <MeetingError error={participants.error} retry={() => void participants.refetch()} /> : participants.isPending ? <p role="status">{t("loading")}</p> : <ul className="max-h-60 space-y-3 overflow-y-auto text-sm">{participants.data.map(p => <li key={p.id} className="flex items-center gap-2"><span className={`size-2 shrink-0 rounded-full ${p.connected ? "bg-live" : "bg-muted-foreground"}`} /><span className="break-words">{p.displayName}{p.guest ? ` (${t("guest")})` : ""}</span></li>)}{!participants.data.length && <li className="text-muted-foreground">{t("noParticipants")}</li>}</ul>}
      </div>
      {canEdit && (meeting.status === "OPEN" || meeting.status === "SCHEDULED") && <section className="workspace-panel space-y-4 p-5"><h2 className="font-semibold">{t("guestInvites")}</h2><p className="text-xs leading-5 text-muted-foreground">{t("invitePolicy")}</p>
        <div className="space-y-3" role="group" aria-label={t("inviteExpiry")}>
          <div className="space-y-2"><Label htmlFor="invite-expiry-date" className="text-sm">{t("inviteExpiryDate")}</Label><DatePicker id="invite-expiry-date" label={t("inviteExpiryDate")} value={expiry.date} min={expiryBounds.min} max={expiryBounds.max} onChange={date => setExpiry(previous => ({ ...previous, date }))} /></div>
          <div className="space-y-2"><Label htmlFor="invite-expiry-time" className="text-sm">{t("inviteExpiryTime")}</Label><TimePicker id="invite-expiry-time" label={t("inviteExpiryTime")} value={expiry.time} onChange={time => setExpiry(previous => ({ ...previous, time }))} /></div>
        </div>
        <label className="block space-y-2 text-sm">{t("maxUses")}<Input type="number" min={1} max={100} value={maxUses} onChange={e => setMaxUses(Number(e.target.value))} /></label>
        <Button variant="outline" className="min-h-11 w-full" disabled={busy || !expiresAt || maxUses < 1 || maxUses > 100} onClick={() => void createInvite()}>{t("createInvite")}</Button>
        {inviteMetadata.isError && <MeetingError error={inviteMetadata.error} retry={() => void inviteMetadata.refetch()} />}
        {inviteMetadata.isPending && <p role="status" className="text-sm">{t("loading")}</p>}
        <ul className="space-y-3">{inviteMetadata.data?.content.map((invite, index) => {
          const capability = invites.find(item => item.id === invite.id);
          return <li key={invite.id} className="space-y-2 border-t pt-3"><p className="text-sm">{t("inviteNumber", { number: invitePage * 10 + index + 1 })}</p><p className="text-xs text-muted-foreground">{invite.uses}/{invite.maxUses} · {new Date(invite.expiresAt).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })}</p>{invite.revoked ? <p className="text-xs text-muted-foreground">{t("inviteRevoked")}</p> : <div className="flex flex-wrap gap-2">{capability && <Button variant="outline" onClick={() => void copy(capability)}>{t(copied === invite.id ? "copied" : "copy")}</Button>}<ConfirmDialog trigger={<Button variant="ghost">{t("revokeInvite")}</Button>} title={t("revokeInvite")} description={t("revokePolicy")} confirmLabel={t("confirm")} cancelLabel={t("cancel")} onConfirm={async () => { await meetingsApi.revokeInvite(context.project!.id, id, invite.id); setInvites(previous => previous.filter(i => i.id !== invite.id)); await client.invalidateQueries({ queryKey: [...context.keys, id, "invites"] }); }} /></div>}</li>;
        })}</ul>
        {(inviteMetadata.data?.totalPages ?? 0) > 1 && <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!invitePage} onClick={() => setInvitePage(p => p - 1)}>{t("previous")}</Button><Button variant="outline" disabled={invitePage + 1 >= (inviteMetadata.data?.totalPages ?? 0)} onClick={() => setInvitePage(p => p + 1)}>{t("next")}</Button></div>}
        <p className="text-xs leading-5 text-muted-foreground">{t("inviteMemory")}</p>
      </section>}</aside>
    </div>
  </PageContainer>;
}

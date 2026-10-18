"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link, { useRouter } from "@/i18n/navigation";
import { Video, CalendarDays, ListChecks, Users } from "lucide-react";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { membersApi } from "@/features/projects/members-api";
import { sessionQueryKey } from "@/features/auth/hooks/use-session";
import type { Member } from "@/features/projects/types";
import type { Meeting, MeetingInput } from "./types";
import { meetingsApi } from "./api";
import { localDateTime, MeetingError, useMeetingProject } from "./shared";

export function MeetingForm({ slug, meeting }: { slug: string; meeting?: Meeting }) {
  const t = useTranslations("meetings"), router = useRouter(), client = useQueryClient();
  const context = useMeetingProject(slug);
  const [title, setTitle] = useState(meeting?.title ?? "");
  const [description, setDescription] = useState(meeting?.description ?? "");
  const [startsAt, setStartsAt] = useState(() => localDateTime(meeting?.startsAt ?? new Date(Date.now() + 3600_000).toISOString()));
  const [endsAt, setEndsAt] = useState(() => localDateTime(meeting?.endsAt ?? new Date(Date.now() + 7200_000).toISOString()));
  const [agenda, setAgenda] = useState(meeting?.agenda ?? [""]);
  const [attendees, setAttendees] = useState(meeting?.attendeeIds ?? []);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState<unknown>();
  const [invalid, setInvalid] = useState(false);
  const [created, setCreated] = useState<Meeting>();
  const inFlight = useRef(false), summary = useRef<HTMLDivElement>(null);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty || busy || created) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, busy, created]);
  const zoneId = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const members = useQuery({ queryKey: [...context.keys, "members"], enabled: !!context.project,
    queryFn: async () => {
      const result: Member[] = [];
      for (let page = 0; ; page++) { const response = await membersApi.list(context.project!.id, page, 100); result.push(...response.content); if (page + 1 >= response.totalPages) return result; }
    }, retry: false });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!context.project || inFlight.current) return;
    const immediate = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "now";
    const start = immediate ? new Date() : new Date(startsAt);
    const end = new Date(endsAt);
    const validDates = Number.isFinite(start.getTime()) && Number.isFinite(end.getTime());
    const roundTrip = validDates && (immediate || localDateTime(start.toISOString()) === startsAt) && localDateTime(end.toISOString()) === endsAt;
    if (!title.trim() || !validDates || !roundTrip || end <= start || end.getTime() - start.getTime() > 86400_000 || (!immediate && start.getTime() < new Date().getTime()) || agenda.filter(a => a.trim()).length > 30 || attendees.length > 100) {
      setInvalid(true); requestAnimationFrame(() => summary.current?.focus()); return;
    }
    setInvalid(false); setError(undefined); inFlight.current = true; setBusy(true);
    const actorId = context.user?.id;
    const currentActor = () => !!actorId && client.getQueryData<{ id: string }>(sessionQueryKey)?.id === actorId;
    try {
      const body: MeetingInput = { title: title.trim(), description, startsAt: start.toISOString(), endsAt: end.toISOString(), zoneId, agenda: agenda.map(a => a.trim()).filter(Boolean), attendeeIds: attendees };
      // A failed start must never create a second meeting on retry.
      let saved = created ?? (meeting ? await meetingsApi.update(context.project.id, meeting.id, body, currentActor) : await meetingsApi.create(context.project.id, body, currentActor));
      if (!currentActor()) return;
      setCreated(saved);
      if (immediate) saved = await meetingsApi.action(context.project.id, saved.id, "start", currentActor);
      if (!currentActor()) return;
      await client.invalidateQueries({ queryKey: context.keys });
      router.push(`/projects/${slug}/meetings/${saved.id}`);
    } catch (failure) { setError(failure); } finally { inFlight.current = false; setBusy(false); }
  }
  if (context.isError) return <MeetingError error={context.error} />;
  const canEdit = !meeting || context.isManager || context.user?.id === meeting.organizerId;
  if (!canEdit || (meeting && meeting.status !== "SCHEDULED")) return <p role="alert">{t("forbidden")}</p>;
  return <PageContainer width="form">
    <Link href={`/projects/${slug}/meetings`} className="mb-4 inline-flex min-h-11 items-center text-sm text-muted-foreground underline underline-offset-4">{t("back")}</Link>
    <PageHeader title={t(meeting ? "edit" : "create")} description={context.project?.name ?? t("loading")} />
    <form data-meeting-form onChange={() => setDirty(true)} onSubmit={submit} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="workspace-panel min-w-0 divide-y">
        {invalid && <div ref={summary} tabIndex={-1} role="alert" className="p-5 text-sm text-destructive">{t("formInvalid")} <a href="#meeting-title" className="underline">{t("basic")}</a> · <a href="#meeting-start" className="underline">{t("schedule")}</a></div>}
        {error != null && <MeetingError error={error} />}
        {created && <p role="status" className="p-5 text-sm">{t("createdRecovery")} <Link className="underline" href={`/projects/${slug}/meetings/${created.id}`}>{t("detail")}</Link></p>}
        <section className="space-y-5 p-5 sm:p-6"><h2 className="flex items-center gap-2 font-semibold"><Video size={18} className="text-primary" />{t("basic")}</h2>
          <div className="space-y-2"><Label htmlFor="meeting-title">{t("title")}</Label><Input id="meeting-title" required maxLength={160} value={title} disabled={!!created} onChange={e => setTitle(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="meeting-description">{t("description")}</Label><Textarea id="meeting-description" maxLength={4000} rows={4} value={description} disabled={!!created} onChange={e => setDescription(e.target.value)} /></div>
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Video size={16} />{t("online")}</p>
        </section>
        <section className="space-y-5 p-5 sm:p-6"><h2 className="flex items-center gap-2 font-semibold"><CalendarDays size={18} className="text-primary" />{t("schedule")}</h2>
          <p className="text-sm text-muted-foreground">{t("timezone", { zone: zoneId })}</p>
          <div className="grid gap-4 sm:grid-cols-2"><div className="min-w-0 space-y-2"><Label htmlFor="meeting-start">{t("start")}</Label><Input id="meeting-start" type="datetime-local" required value={startsAt} disabled={!!created} onChange={e => setStartsAt(e.target.value)} className="min-w-0" /></div>
          <div className="min-w-0 space-y-2"><Label htmlFor="meeting-end">{t("end")}</Label><Input id="meeting-end" type="datetime-local" required value={endsAt} disabled={!!created} onChange={e => setEndsAt(e.target.value)} className="min-w-0" /></div></div>
        </section>
        <section className="space-y-4 p-5 sm:p-6"><h2 className="flex items-center gap-2 font-semibold"><ListChecks size={18} className="text-primary" />{t("agenda")}</h2>
          {agenda.map((item, index) => <div key={index} className="flex items-center gap-2"><span aria-hidden="true" className="text-sm tabular-nums text-muted-foreground">{index + 1}.</span><Input aria-label={t("agendaItem", { number: index + 1 })} maxLength={1000} value={item} disabled={!!created} onChange={e => setAgenda(previous => previous.map((a, i) => i === index ? e.target.value : a))} /><Button type="button" variant="ghost" disabled={!!created} aria-label={t("removeAgenda", { number: index + 1 })} onClick={() => setAgenda(previous => previous.filter((_, i) => i !== index))}>×</Button></div>)}
          <Button type="button" variant="outline" disabled={agenda.length >= 30 || !!created} onClick={() => setAgenda(previous => [...previous, ""])}>{t("addAgenda")}</Button>
        </section>
      </div>
      <aside className="space-y-5 lg:sticky lg:top-24"><section className="workspace-panel space-y-4 p-5"><h2 className="flex items-center gap-2 font-semibold"><Users size={18} className="text-primary" />{t("attendees")} <span className="ml-auto text-sm text-muted-foreground">{attendees.length}/100</span></h2>
        <Input aria-label={t("searchMembers")} placeholder={t("searchMembers")} value={search} onChange={e => setSearch(e.target.value)} />
        {members.isPending && <p role="status" className="text-sm text-muted-foreground">{t("loading")}</p>}{members.isError && <MeetingError error={members.error} retry={() => void members.refetch()} />}
        <div className="max-h-72 overflow-y-auto">{members.data?.filter(member => (member.nickname ?? "").toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(member => <label key={member.userId} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 text-sm hover:bg-muted"><input type="checkbox" checked={attendees.includes(member.userId)} disabled={!!created || (!attendees.includes(member.userId) && attendees.length >= 100)} onChange={e => setAttendees(previous => e.target.checked ? [...previous, member.userId] : previous.filter(id => id !== member.userId))} /><span className="break-words">{member.nickname ?? t("member")}</span></label>)}</div>
        <p className="text-xs leading-5 text-muted-foreground">{t("memberAccess")}</p>
      </section><div className="space-y-3"><Button type="submit" value="plan" disabled={busy || !context.project} className="min-h-11 w-full">{busy ? t("saving") : t(meeting ? "save" : "plan")}</Button>{!meeting && <Button type="submit" value="now" variant="outline" disabled={busy || !context.project} className="min-h-11 w-full">{t("startNow")}</Button>}<Link href={`/projects/${slug}/meetings`} className={buttonVariants({ variant: "ghost", className: "min-h-11 w-full" })}>{t("cancel")}</Link></div></aside>
    </form>
  </PageContainer>;
}

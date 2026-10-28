"use client";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import Link, { useRouter } from "@/i18n/navigation";
import { CalendarDays, Check, ListChecks, Plus, Search, UserPlus, Video, X } from "lucide-react";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { profilePhotoSrc } from "@/features/account/api";
import { sessionQueryKey } from "@/features/auth/hooks/use-session";
import { membersApi } from "@/features/projects/members-api";
import { useQuery } from "@tanstack/react-query";
import { localizeHref } from "@/i18n/routing";
import type { Locale } from "@/i18n/config";
import { MeetingIconPicker } from "./meeting-icons";
import type { Meeting, MeetingIconName, MeetingInput, MeetingPerson, MeetingProject } from "./types";
import { MeetingKindBadge, ProjectChip } from "./meeting-kind";
import { meetingsApi } from "./api";
import { markAutoJoin } from "./autojoin";
import { DurationText } from "./meeting-card";
import { joinLocal, localDateTime, scheduleProblem, splitLocal } from "./meeting-schedule";
import { MeetingError, useMeetingAccount } from "./shared";

const MAX_ATTENDEES = 100, MAX_AGENDA = 30, MIN_SEARCH = 3;

function Section({ icon, title, description, children }: { icon: ReactNode; title: string; description?: string; children: ReactNode }) {
  return <section className="workspace-panel space-y-5 p-5 sm:p-6">
    <div className="space-y-1"><h2 className="flex items-center gap-2 text-base font-semibold"><span aria-hidden="true" className="text-meeting-ink">{icon}</span>{title}</h2>{description && <p className="text-sm text-muted-foreground">{description}</p>}</div>
    {children}
  </section>;
}

/**
 * Plans or edits a meeting. One form for both kinds: an independent meeting (no project; attendees found by name among all people) and a
 * project meeting (`project` chosen before; the project's members are offered first, but nobody is added unless the organizer picks them).
 * The kind is fixed at creation; editing shows the saved one.
 */
export function MeetingForm({ meeting, project: chosen }: { meeting?: Meeting; project?: MeetingProject }) {
  const t = useTranslations("meetings"), router = useRouter(), client = useQueryClient(), locale = useLocale() as Locale;
  const context = useMeetingAccount();
  const project = meeting ? meeting.project : chosen ?? null;
  const kind = meeting ? meeting.meetingType : chosen ? "PROJECT" : "INDEPENDENT";
  const [title, setTitle] = useState(meeting?.title ?? "");
  const [description, setDescription] = useState(meeting?.description ?? "");
  const [icon, setIcon] = useState<string>(meeting?.icon ?? "video");
  // The shared pickers edit a calendar day and a clock time separately; the meeting still validates and sends one local date-time.
  const [start, setStart] = useState(() => splitLocal(localDateTime(meeting?.startsAt ?? new Date(Date.now() + 3600_000).toISOString())));
  const [end, setEnd] = useState(() => splitLocal(localDateTime(meeting?.endsAt ?? new Date(Date.now() + 7200_000).toISOString())));
  const startsAt = joinLocal(start), endsAt = joinLocal(end);
  const [agenda, setAgenda] = useState(meeting?.agenda?.length ? meeting.agenda : [""]);
  const [focusAgenda, setFocusAgenda] = useState<number>();
  // The invited people with their display profile (the server returns the profile of every attendee), and the person search box.
  const [picked, setPicked] = useState<MeetingPerson[]>(meeting?.attendees ?? []);
  const attendees = picked.map(person => person.userId);
  const [search, setSearch] = useState(""), [debounced, setDebounced] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState<unknown>();
  const [invalid, setInvalid] = useState(false);
  const [created, setCreated] = useState<Meeting>();
  const inFlight = useRef(false), summary = useRef<HTMLDivElement>(null);
  // A polite announcement of what just changed: the person leaves the list they were chosen from, so without it nothing says that it worked.
  const [announcement, setAnnouncement] = useState("");
  // The button a keyboard user just pressed leaves the list it was in (a suggestion becomes an attendee, an attendee goes away): the focus is put on its
  // neighbour in the same list, or on the search box when the list is empty, so it is never dropped on the page itself.
  const focusAfter = useRef<{ list: "members" | "results" | "picked"; index: number } | null>(null);
  useEffect(() => {
    const target = focusAfter.current; if (!target) return; focusAfter.current = null;
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(`[data-attendee-list="${target.list}"] button:not(:disabled)`));
    (buttons[Math.min(target.index, buttons.length - 1)] ?? document.getElementById("meeting-attendee-search"))?.focus();
  }, [picked]);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty || busy || created) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, busy, created]);
  const zoneId = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const organizerId = meeting?.organizerId ?? context.user?.id;
  const organizer: MeetingPerson | null = meeting ? meeting.organizer : context.user ? { userId: context.user.id, nickname: context.user.nickname, profilePhotoVersion: context.user.profilePhotoVersion ?? null } : null;
  useEffect(() => { const timer = setTimeout(() => setDebounced(search.trim()), 300); return () => clearTimeout(timer); }, [search]);
  const searching = debounced.length >= MIN_SEARCH;
  // Global and nickname-only (no project, no e-mail); the key carries the account but never a project.
  const found = useQuery({ queryKey: [...context.keys, "people", debounced.toLocaleLowerCase()], enabled: !!context.user && searching && !created, staleTime: 30_000, retry: false,
    queryFn: ({ signal }) => meetingsApi.searchPeople(debounced, signal) });
  // Offered first on a project meeting. Being a member of the project is not being an attendee: nobody is added until the organizer picks them.
  const members = useQuery({ queryKey: [...context.keys, "project-members", project?.id], enabled: !!context.user && !!project && !created, staleTime: 60_000, retry: false,
    queryFn: ({ signal }) => membersApi.listAll(project!.id, signal) });
  const problem = scheduleProblem(startsAt, endsAt, false);
  // A problem is shown once the person has touched the form or tried to submit; a fresh form is not scolded.
  const showProblem = problem && (invalid || dirty) ? problem : null;
  useEffect(() => { if (focusAgenda !== undefined) document.getElementById(`meeting-agenda-${focusAgenda}`)?.focus(); }, [focusAgenda, agenda.length]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!context.user || inFlight.current) return;
    const immediate = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "now";
    const startTime = immediate ? new Date() : new Date(startsAt), endTime = new Date(endsAt);
    if (!title.trim() || scheduleProblem(startsAt, endsAt, immediate) || agenda.filter(a => a.trim()).length > MAX_AGENDA || attendees.length > MAX_ATTENDEES) {
      setInvalid(true); requestAnimationFrame(() => summary.current?.focus()); return;
    }
    setInvalid(false); setError(undefined); inFlight.current = true; setBusy(true);
    const actorId = context.user?.id;
    const currentActor = () => !!actorId && client.getQueryData<{ id: string }>(sessionQueryKey)?.id === actorId;
    try {
      const body: MeetingInput = { title: title.trim(), description, startsAt: startTime.toISOString(), endsAt: endTime.toISOString(), zoneId, agenda: agenda.map(a => a.trim()).filter(Boolean), attendeeIds: attendees, icon: icon as MeetingIconName,
        // "Start now": the server clock becomes the start (see MeetingService.create), so this device clock cannot make the request a past one.
        ...(immediate && !meeting ? { startNow: true } : {}),
        // The kind and the project are decided once, here; the server checks the project again and an update never changes them.
        ...(meeting ? {} : { meetingType: kind, projectId: project?.id ?? null }) };
      // A failed start must never create a second meeting on retry.
      let saved = created ?? (meeting ? await meetingsApi.update(meeting.id, body, currentActor) : await meetingsApi.create(body, currentActor));
      if (!currentActor()) return;
      setCreated(saved);
      if (immediate) saved = await meetingsApi.action(saved.id, "start", currentActor);
      if (!currentActor()) return;
      await client.invalidateQueries({ queryKey: context.keys });
      // A started meeting goes straight to its call: entering a room needs a full document load (media CSP / permissions are per document),
      // and the one-time auto-join note joins with the microphone and camera still off, so nothing is switched on without the person asking for it.
      if (immediate) { markAutoJoin(saved.id); window.location.assign(new URL(localizeHref(`/meetings/${saved.id}/room`, locale), window.location.origin).href); return; }
      router.push(`/meetings/${saved.id}`);
    } catch (failure) { setError(failure); } finally { inFlight.current = false; setBusy(false); }
  }
  // Only the organizer edits, and only while the meeting is still planned (the server enforces both).
  const canEdit = !meeting || context.user?.id === meeting.organizerId;
  if (!canEdit || (meeting && meeting.status !== "SCHEDULED")) return <p role="alert">{t("forbidden")}</p>;

  const locked = !!created;
  const memberIds = new Set((members.data ?? []).map(member => member.userId)), needle = search.trim().toLocaleLowerCase();
  const memberCandidates = (members.data ?? []).filter(member => member.userId !== organizerId && !attendees.includes(member.userId) && (!needle || (member.nickname ?? "").toLocaleLowerCase().includes(needle)))
    .map((member): MeetingPerson => ({ userId: member.userId, nickname: member.nickname ?? "", profilePhotoVersion: member.profilePhotoVersion ?? null }));
  // People already listed as project members are not repeated among the search results.
  const candidates = (found.data ?? []).filter(person => person.userId !== organizerId && !attendees.includes(person.userId) && !memberIds.has(person.userId));
  const selected = new Set([...(organizerId ? [organizerId] : []), ...attendees]).size;
  const add =(person: MeetingPerson, list: "members" | "results", index: number) => { setPicked(previous => previous.some(p => p.userId === person.userId) || previous.length >= MAX_ATTENDEES ? previous : [...previous, person]); setDirty(true); focusAfter.current = { list, index }; setAnnouncement(t("attendeeAdded", { name: person.nickname })); };
  const remove = (userId: string, index: number) => { const gone = picked.find(person => person.userId === userId); setPicked(previous => previous.filter(person => person.userId !== userId)); setDirty(true); focusAfter.current = { list: "picked", index }; if (gone) setAnnouncement(t("attendeeRemoved", { name: gone.nickname })); };
  const durationMinutes = !problem || problem === "past" ? Math.round((Date.parse(endsAt) - Date.parse(startsAt)) / 60_000) : 0;

  return <PageContainer width="form">
    {meeting && <Link href="/meetings" className="mb-4 inline-flex min-h-11 items-center text-sm text-muted-foreground underline underline-offset-4">{t("back")}</Link>}
    <PageHeader title={t(meeting ? "edit" : kind === "PROJECT" ? "createProjectMeeting" : "createIndependentMeeting")} />
    <div data-meeting-kind-bar className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border bg-card px-4 py-2 text-sm">
      <MeetingKindBadge meeting={{ meetingType: kind }} />
      {project ? <ProjectChip project={project} /> : kind === "PROJECT" ? null : <span className="text-muted-foreground">{t("independentNote")}</span>}
      {!meeting && project && <Link href="/meetings/new?type=project" className="ml-auto inline-flex min-h-11 items-center text-sm text-muted-foreground underline underline-offset-4">{t("changeProject")}</Link>}
    </div>
    <form data-meeting-form noValidate onChange={() => setDirty(true)} onSubmit={submit} className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-5">
        {invalid && <div ref={summary} tabIndex={-1} role="alert" className="workspace-panel border-destructive/50 p-4 text-sm text-destructive">{t("formInvalid")} <a href="#meeting-title" className="underline">{t("basic")}</a> · <a href="#meeting-start-date" className="underline">{t("schedule")}</a></div>}
        {error != null && <MeetingError error={error} />}
        {created && <p role="status" className="workspace-panel p-4 text-sm">{t("createdRecovery")} <Link className="underline" href={`/meetings/${created.id}`}>{t("detail")}</Link></p>}
        <Section icon={<Video size={18} />} title={t("basic")}>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2"><Label htmlFor="meeting-title">{t("title")}</Label><span aria-hidden="true" className="text-xs tabular-nums text-muted-foreground">{title.length}/160</span></div>
            <Input id="meeting-title" required maxLength={160} value={title} disabled={locked} placeholder={t("titlePlaceholder")} aria-invalid={invalid && !title.trim() ? true : undefined} aria-describedby={invalid && !title.trim() ? "meeting-title-error" : undefined} onChange={e => setTitle(e.target.value)} className="h-11 text-base md:h-10 md:text-sm" />
            {invalid && !title.trim() && <p id="meeting-title-error" className="text-sm text-destructive">{t("errTitleRequired")}</p>}
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2"><Label htmlFor="meeting-description">{t("description")}</Label><span aria-hidden="true" className="text-xs tabular-nums text-muted-foreground">{description.length}/4000</span></div>
            <Textarea id="meeting-description" maxLength={4000} rows={4} value={description} disabled={locked} placeholder={t("descriptionPlaceholder")} onChange={e => setDescription(e.target.value)} className="max-h-72 min-h-28 field-sizing-content text-base md:text-sm" />
          </div>
          <MeetingIconPicker value={icon} onChange={name => { setIcon(name); setDirty(true); }} disabled={locked} />
        </Section>
        <Section icon={<CalendarDays size={18} />} title={t("schedule")} description={t("timezone", { zone: zoneId })}>
          <div className="grid gap-5 sm:grid-cols-2">
            {([["start", start, setStart, undefined], ["end", end, setEnd, start.date || undefined]] as const).map(([key, value, set, min]) => <fieldset key={key} className="min-w-0 space-y-3 rounded-lg border p-4" disabled={locked}>
              <legend className="px-1 text-sm font-semibold">{t(key === "start" ? "startLabel" : "endLabel")}</legend>
              <div className="min-w-0 space-y-2"><Label htmlFor={`meeting-${key}-date`}>{t(key === "start" ? "startDate" : "endDate")}</Label><DatePicker id={`meeting-${key}-date`} label={t(key === "start" ? "startDate" : "endDate")} value={value.date} min={min ?? localDateTime(new Date().toISOString()).slice(0, 10)} onChange={date => { set(previous => ({ ...previous, date })); setDirty(true); }} invalid={(invalid && !value.date) || (!!showProblem && showProblem !== "past" && key === "end") || (showProblem === "past" && key === "start")} /></div>
              <div className="min-w-0 space-y-2"><Label htmlFor={`meeting-${key}-time`}>{t(key === "start" ? "startTime" : "endTime")}</Label><TimePicker id={`meeting-${key}-time`} label={t(key === "start" ? "startTime" : "endTime")} value={value.time} onChange={time => { set(previous => ({ ...previous, time })); setDirty(true); }} invalid={(invalid && !value.time) || (showProblem === "nonexistent")} /></div>
            </fieldset>)}
          </div>
          <div aria-live="polite" className="min-h-5 text-sm">
            {showProblem ? <p role="alert" className="text-destructive">{t(`err_${showProblem}`)}</p> : durationMinutes > 0 ? <p className="text-muted-foreground">{t("durationLabel")}: <DurationText minutes={durationMinutes} /></p> : null}
          </div>
        </Section>
        <Section icon={<ListChecks size={18} />} title={t("agendaOptional")} description={t("agendaHint")}>
          <ol className="space-y-2.5">
            {agenda.map((item, index) => <li key={index} className="flex items-center gap-2">
              <span aria-hidden="true" className="w-6 shrink-0 text-right text-sm tabular-nums text-muted-foreground">{index + 1}.</span>
              <Input id={`meeting-agenda-${index}`} aria-label={t("agendaItem", { number: index + 1 })} maxLength={1000} value={item} disabled={locked} className="h-11 text-base md:h-10 md:text-sm"
                onChange={e => setAgenda(previous => previous.map((a, i) => i === index ? e.target.value : a))}
                onKeyDown={event => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); if (agenda.length < MAX_AGENDA && item.trim()) { setAgenda(previous => [...previous.slice(0, index + 1), "", ...previous.slice(index + 1)]); setFocusAgenda(index + 1); } } }} />
              <Button type="button" variant="ghost" className="size-11 shrink-0 md:size-9" disabled={locked} aria-label={t("removeAgenda", { number: index + 1 })} onClick={() => { setAgenda(previous => previous.length > 1 ? previous.filter((_, i) => i !== index) : [""]); setDirty(true); }}><X size={16} aria-hidden="true" /></Button>
            </li>)}
          </ol>
          <Button type="button" variant="outline" className="min-h-11 border-border-strong md:min-h-10" disabled={agenda.length >= MAX_AGENDA || locked} onClick={() => { setAgenda(previous => [...previous, ""]); setFocusAgenda(agenda.length); }}><Plus size={16} aria-hidden="true" />{t("addAgenda")}</Button>
        </Section>
      </div>
      <aside className="min-w-0 space-y-5 lg:sticky lg:top-24">
        <section className="workspace-panel space-y-4 p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold">{t("attendees")}<span className="ml-auto rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground" aria-label={t("participantCount", { count: selected })}>{selected}</span></h2>
          <div className="relative">
            <Search size={16} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
            <Input id="meeting-attendee-search" type="search" aria-label={t("searchPeople")} placeholder={t("searchPeopleHint", { min: MIN_SEARCH })} value={search} maxLength={64} disabled={locked} onChange={e => setSearch(e.target.value)} className="h-11 pl-9 text-base md:h-10 md:text-sm" />
          </div>
          <div aria-live="polite" className="space-y-1">
            {!searching && <p className="text-xs leading-5 text-muted-foreground">{t("searchPeopleHint", { min: MIN_SEARCH })}</p>}
            {searching && found.isPending && <p role="status" className="text-sm text-muted-foreground">{t("loading")}</p>}
            {searching && found.isError && <MeetingError error={found.error} retry={() => void found.refetch()} />}
            {searching && found.isSuccess && !(found.data ?? []).length && <p className="px-2 py-2 text-sm text-muted-foreground">{t("noPeopleFound")}</p>}
            {searching && found.isSuccess && (found.data ?? []).length > 0 && !candidates.length && !memberCandidates.length && <p className="px-2 py-2 text-sm text-muted-foreground">{t("allMatchesAdded")}</p>}
            {searching && found.isSuccess && candidates.length > 0 && <p className="sr-only">{t("peopleFound", { count: candidates.length })}</p>}
            <p role="status" className="sr-only">{announcement}</p>
          </div>
          {project && <div data-project-members className="space-y-1.5">
            <h3 className="px-1 text-xs font-semibold text-muted-foreground">{t("projectMembers", { project: project.name })}</h3>
            {members.isPending ? <p role="status" className="px-1 text-sm text-muted-foreground">{t("loading")}</p>
              : members.isError ? <MeetingError error={members.error} retry={() => void members.refetch()} />
              : memberCandidates.length ? <ul aria-label={t("projectMembersList")} data-attendee-list="members" className="max-h-52 min-w-0 space-y-0.5 overflow-y-auto overscroll-contain rounded-lg border p-1" data-workspace-scroll>
                {memberCandidates.map((person, position) => <li key={person.userId}><button type="button" disabled={locked || attendees.length >= MAX_ATTENDEES} onClick={() => add(person, "members", position)} aria-label={t("addAttendee", { name: person.nickname })}
                  className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-md px-2 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50">
                  <span aria-hidden="true" className="contents"><Avatar name={person.nickname} src={profilePhotoSrc(person.userId, person.profilePhotoVersion)} title={false} className="size-8 ring-0" /></span>
                  <span className="min-w-0 flex-1 break-words">{person.nickname}</span>
                  <UserPlus size={16} aria-hidden="true" className="shrink-0 text-meeting-ink" />
                </button></li>)}</ul>
              : <p className="px-1 text-sm text-muted-foreground">{t(needle ? "noProjectMembersFound" : "allProjectMembersAdded")}</p>}
          </div>}
          {searching && found.isSuccess && candidates.length > 0 && <ul aria-label={t("searchResults")} data-attendee-list="results" className="max-h-60 min-w-0 space-y-0.5 overflow-y-auto overscroll-contain rounded-lg border p-1" data-workspace-scroll>
            {candidates.map((person, position) => <li key={person.userId}><button type="button" disabled={locked || attendees.length >= MAX_ATTENDEES} onClick={() => add(person, "results", position)} aria-label={t("addAttendee", { name: person.nickname })}
              className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-md px-2 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50">
              <span aria-hidden="true" className="contents"><Avatar name={person.nickname} src={profilePhotoSrc(person.userId, person.profilePhotoVersion)} title={false} className="size-8 ring-0" /></span>
              <span className="min-w-0 flex-1 break-words">{person.nickname}</span>
              <UserPlus size={16} aria-hidden="true" className="shrink-0 text-meeting-ink" />
            </button></li>)}
          </ul>}
          <ul aria-label={t("selectedAttendees")} data-attendee-list="picked" className="max-h-72 min-w-0 space-y-0.5 overflow-y-auto overscroll-contain" data-workspace-scroll>
            {organizer && <li><div className="flex min-h-12 items-center gap-3 rounded-md px-2 text-sm">
              <Avatar name={organizer.nickname} src={profilePhotoSrc(organizer.userId, organizer.profilePhotoVersion)} title={false} className="size-8 ring-0" />
              <span className="min-w-0 flex-1 break-words font-medium">{organizer.nickname}</span>
              <span className="rounded-full bg-meeting-soft px-2 py-0.5 text-xs font-medium text-meeting-ink">{t("organizer")}</span>
              <span aria-hidden="true" className="grid size-4 shrink-0 place-items-center rounded-[4px] bg-muted-foreground/40 text-background"><Check size={12} /></span>
            </div></li>}
            {picked.map((person, position) => <li key={person.userId}><div className="flex min-h-12 items-center gap-3 rounded-md bg-meeting-soft/60 px-2 text-sm">
              <Avatar name={person.nickname} src={profilePhotoSrc(person.userId, person.profilePhotoVersion)} title={false} className="size-8 ring-0" />
              <span className="min-w-0 flex-1 break-words">{person.nickname}</span>
              <Button type="button" variant="ghost" className="size-11 shrink-0 md:size-9" disabled={locked} aria-label={t("removeAttendee", { name: person.nickname })} onClick={() => remove(person.userId, position)}><X size={16} aria-hidden="true" /></Button>
            </div></li>)}
          </ul>
          <p className="text-xs leading-5 text-muted-foreground">{t(project ? "projectAttendeeAccess" : "attendeeAccess")}</p>
        </section>
        <section className="workspace-panel space-y-3 p-5">
          <Button type="submit" value="plan" variant="accent" disabled={busy || !context.user} className="min-h-11 w-full">{busy ? t("saving") : t(meeting ? "save" : "plan")}</Button>
          {!meeting && <Button type="submit" value="now" variant="outline" disabled={busy || !context.user} className="min-h-11 w-full border-border-strong">{t("startNow")}</Button>}
          <Link href="/meetings" className={buttonVariants({ variant: "ghost", className: "min-h-11 w-full" })}>{t("cancel")}</Link>
        </section>
      </aside>
    </form>
  </PageContainer>;
}
